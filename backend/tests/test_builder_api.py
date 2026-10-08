from fastapi.testclient import TestClient

from app.main import app


def test_seeded_forms_and_builder_crud():
    with TestClient(app) as client:
        seeded = client.get("/api/forms")
        assert seeded.status_code == 200
        assert len(seeded.json()) >= 2

        created = client.post("/api/forms", json={"title": "API test form"})
        assert created.status_code == 201
        form_id = created.json()["id"]

        first = client.post(f"/api/forms/{form_id}/questions", json={"type": "short_text", "title": "First question", "required": True})
        second = client.post(f"/api/forms/{form_id}/questions", json={"type": "multiple_choice", "title": "Second question", "options": ["One", "Two"]})
        assert first.status_code == 201
        assert second.status_code == 201

        reordered = client.put(f"/api/forms/{form_id}/questions/reorder", json={"question_ids": [second.json()["id"], first.json()["id"]]})
        assert reordered.status_code == 200
        assert [item["title"] for item in reordered.json()] == ["Second question", "First question"]

        updated = client.patch(f"/api/questions/{first.json()['id']}", json={"title": "Updated question", "description": "Helper text"})
        assert updated.status_code == 200
        assert updated.json()["description"] == "Helper text"
        experience = client.patch(f"/api/forms/{form_id}/experience", json={"theme": "sage", "thank_you_title": "All set!", "thank_you_message": "We received your answer."})
        assert experience.status_code == 200
        assert experience.json() == {"theme": "sage", "appearance": {}, "thank_you_title": "All set!", "thank_you_message": "We received your answer."}
        preview = client.get(f"/api/forms/{form_id}/preview")
        assert preview.status_code == 200
        assert preview.json()["status"] == "draft"
        assert preview.json()["theme"] == "sage"

        published = client.patch(f"/api/forms/{form_id}/publication", json={"status": "published"})
        assert published.status_code == 200
        assert published.json()["share_path"].startswith("/f/")
        public = client.get(f"/api/public/forms/{published.json()['slug']}")
        assert public.status_code == 200
        assert public.json()["id"] == form_id
        invalid_submission = client.post(f"/api/public/forms/{published.json()['slug']}/responses", json={"answers": {}})
        assert invalid_submission.status_code == 422
        submission = client.post(f"/api/public/forms/{published.json()['slug']}/responses", json={"answers": {first.json()['id']: "Ava", second.json()['id']: "One"}})
        assert submission.status_code == 201
        assert submission.json()["thank_you_title"] == "All set!"
        responses = client.get(f"/api/forms/{form_id}/responses")
        assert responses.status_code == 200
        assert responses.json()["total"] == 1
        response_id = responses.json()["items"][0]["id"]
        detail = client.get(f"/api/forms/{form_id}/responses/{response_id}")
        assert detail.status_code == 200
        assert len(detail.json()["answers"]) == 2
        summary = client.get(f"/api/forms/{form_id}/results/summary")
        assert summary.status_code == 200
        multiple_choice = next(item for item in summary.json()["questions"] if item["question_id"] == second.json()["id"])
        assert multiple_choice["choice_counts"][0] == {"value": "One", "count": 1, "percentage": 100.0}
        assert client.delete(f"/api/forms/{form_id}").status_code == 204


def test_builder_changes_survive_a_fresh_api_read():
    with TestClient(app) as client:
        form = client.post("/api/forms", json={"title": "Persistence audit"}).json()
        form_id = form["id"]
        first = client.post(f"/api/forms/{form_id}/questions", json={"type": "multiple_choice", "title": "Pick a color", "description": "Choose one", "required": True, "settings": {"allowOther": True}, "options": ["Red", "Blue", "Green"]}).json()
        second = client.post(f"/api/forms/{form_id}/questions", json={"type": "short_text", "title": "Why?", "settings": {"placeholder": "Tell us why"}}).json()
        changed = client.patch(f"/api/questions/{first['id']}", json={"type": "dropdown", "title": "Pick your favorite color", "description": "Updated help", "required": False, "settings": {"allowOther": False}, "options": ["Green", "Blue", "Red"]})
        assert changed.status_code == 200
        assert client.put(f"/api/forms/{form_id}/questions/reorder", json={"question_ids": [second["id"], first["id"]]}).status_code == 200
        assert client.patch(f"/api/forms/{form_id}/experience", json={"theme": "ink", "thank_you_title": "Saved!", "thank_you_message": "Thank you for taking part."}).status_code == 200
        assert client.patch(f"/api/forms/{form_id}", json={"title": "Persistence audit renamed"}).status_code == 200
        assert client.patch(f"/api/forms/{form_id}/publication", json={"status": "published"}).status_code == 200

        reopened = client.get(f"/api/forms/{form_id}")
        assert reopened.status_code == 200
        saved = reopened.json()
        assert saved["title"] == "Persistence audit renamed"
        assert saved["status"] == "published"
        assert saved["theme"] == "ink"
        assert saved["thank_you_title"] == "Saved!"
        assert [question["id"] for question in saved["questions"]] == [second["id"], first["id"]]
        assert saved["questions"][1]["type"] == "dropdown"
        assert saved["questions"][1]["options"] == ["Green", "Blue", "Red"]
        assert saved["questions"][1]["settings"] == {"allowOther": False}
        assert client.delete(f"/api/questions/{second['id']}").status_code == 204
        assert client.get(f"/api/forms/{form_id}").json()["question_count"] == 1
        assert client.delete(f"/api/forms/{form_id}").status_code == 204


def test_deleting_a_midway_question_with_answers_keeps_the_form_editable():
    with TestClient(app) as client:
        form = client.post("/api/forms", json={"title": "Delete answered question"}).json()
        form_id = form["id"]
        first = client.post(f"/api/forms/{form_id}/questions", json={"type": "short_text", "title": "First", "required": True}).json()
        middle = client.post(f"/api/forms/{form_id}/questions", json={"type": "short_text", "title": "Middle"}).json()
        last = client.post(f"/api/forms/{form_id}/questions", json={"type": "short_text", "title": "Last"}).json()
        published = client.patch(f"/api/forms/{form_id}/publication", json={"status": "published"}).json()
        submitted = client.post(f"/api/public/forms/{published['slug']}/responses", json={"answers": {first['id']: "Ava", middle['id']: "remove me", last['id']: "Keep me"}})
        assert submitted.status_code == 201

        deleted = client.delete(f"/api/questions/{middle['id']}")
        assert deleted.status_code == 204
        saved = client.get(f"/api/forms/{form_id}").json()
        assert [question["id"] for question in saved["questions"]] == [first["id"], last["id"]]
        assert client.delete(f"/api/forms/{form_id}").status_code == 204


def test_questions_can_be_deleted_from_every_position_and_reindexed():
    with TestClient(app) as client:
        for target_index in range(4):
            form = client.post("/api/forms", json={"title": "Position delete"}).json()
            form_id = form["id"]
            questions = [
                client.post(f"/api/forms/{form_id}/questions", json={"type": "short_text", "title": title}).json()
                for title in ("First", "Middle", "Second-last", "Last")
            ]
            deleted = client.delete(f"/api/questions/{questions[target_index]['id']}")
            assert deleted.status_code == 204
            saved = client.get(f"/api/forms/{form_id}").json()
            assert saved["question_count"] == 3
            assert [question["position"] for question in saved["questions"]] == [0, 1, 2]
            assert questions[target_index]["id"] not in [question["id"] for question in saved["questions"]]
            assert client.delete(f"/api/forms/{form_id}").status_code == 204


def test_file_upload_answer_is_stored_as_a_server_file_reference():
    with TestClient(app) as client:
        form = client.post("/api/forms", json={"title": "File upload"}).json()
        form_id = form["id"]
        question = client.post(f"/api/forms/{form_id}/questions", json={"type": "file_upload", "title": "Attach proof", "required": True}).json()
        published = client.patch(f"/api/forms/{form_id}/publication", json={"status": "published"}).json()

        uploaded = client.post(f"/api/public/forms/{published['slug']}/uploads", files={"file": ("proof.txt", b"file contents", "text/plain")})
        assert uploaded.status_code == 200
        file_answer = uploaded.json()
        assert file_answer["name"] == "proof.txt"
        assert file_answer["url"].startswith("/uploads/")
        assert client.get(file_answer["url"]).content == b"file contents"

        submitted = client.post(f"/api/public/forms/{published['slug']}/responses", json={"answers": {question['id']: file_answer}})
        assert submitted.status_code == 201
        response_id = client.get(f"/api/forms/{form_id}/responses").json()["items"][0]["id"]
        detail = client.get(f"/api/forms/{form_id}/responses/{response_id}").json()
        assert detail["answers"] == [{"question_id": question["id"], "value": file_answer}]
        assert client.delete(f"/api/forms/{form_id}").status_code == 204


def test_choice_logic_jumps_skip_required_questions_and_persist_routes():
    with TestClient(app) as client:
        form = client.post("/api/forms", json={"title": "Branching"}).json()
        form_id = form["id"]
        first = client.post(f"/api/forms/{form_id}/questions", json={"type": "yes_no", "title": "Continue?", "required": True}).json()
        skipped = client.post(f"/api/forms/{form_id}/questions", json={"type": "short_text", "title": "Skipped", "required": True}).json()
        yes_target = client.post(f"/api/forms/{form_id}/questions", json={"type": "short_text", "title": "Yes target", "required": True}).json()
        no_target = client.post(f"/api/forms/{form_id}/questions", json={"type": "short_text", "title": "No target", "required": True}).json()

        updated = client.patch(f"/api/questions/{first['id']}", json={"settings": {"logic": {"Yes": yes_target["id"], "No": no_target["id"]}}})
        assert updated.status_code == 200
        assert updated.json()["settings"]["logic"] == {"Yes": yes_target["id"], "No": no_target["id"]}
        invalid = client.patch(f"/api/questions/{first['id']}", json={"settings": {"logic": {"Yes": skipped["id"], "No": first["id"]}}})
        assert invalid.status_code == 422

        published = client.patch(f"/api/forms/{form_id}/publication", json={"status": "published"}).json()
        yes_response = client.post(f"/api/public/forms/{published['slug']}/responses", json={"answers": {first["id"]: True, yes_target["id"]: "yes route", no_target["id"]: "finish"}})
        no_response = client.post(f"/api/public/forms/{published['slug']}/responses", json={"answers": {first["id"]: False, no_target["id"]: "no route"}})
        assert yes_response.status_code == 201
        assert no_response.status_code == 201
        details = [client.get(f"/api/forms/{form_id}/responses/{item['id']}").json() for item in client.get(f"/api/forms/{form_id}/responses").json()["items"]]
        answer_sets = [{answer["question_id"] for answer in detail["answers"]} for detail in details]
        assert {first["id"], yes_target["id"], no_target["id"]} in answer_sets
        assert {first["id"], no_target["id"]} in answer_sets
        assert all(skipped["id"] not in answer_set for answer_set in answer_sets)
        assert client.delete(f"/api/forms/{form_id}").status_code == 204
