"""Focused public-flow, results, and form-management API tests."""

import csv
import io


def create_form_with_questions(client, title: str, questions: list[dict]):
    form = client.post("/api/forms", json={"title": title}).json()
    created_questions = [
        client.post(f"/api/forms/{form['id']}/questions", json=question).json()
        for question in questions
    ]
    return form, created_questions


def publish(client, form_id: str):
    response = client.patch(f"/api/forms/{form_id}/publication", json={"status": "published"})
    assert response.status_code == 200
    return response.json()


def test_public_submission_validates_answers_and_tracks_partial_completion(client):
    form, (email, number) = create_form_with_questions(
        client,
        "Validation and completion",
        [
            {"type": "email", "title": "Work email", "required": True},
            {"type": "number", "title": "Team size", "required": True, "settings": {"min": 2, "max": 10}},
        ],
    )
    published = publish(client, form["id"])
    slug = published["slug"]

    assert client.get(f"/api/public/forms/{slug}").status_code == 200
    invalid_email = client.post(f"/api/public/forms/{slug}/responses", json={"answers": {email["id"]: "not-an-email", number["id"]: 4}})
    assert invalid_email.status_code == 422
    assert invalid_email.json()["detail"]["errors"][email["id"]] == "Enter a valid email address."

    invalid_number = client.post(f"/api/public/forms/{slug}/responses", json={"answers": {email["id"]: "person@example.com", number["id"]: 12}})
    assert invalid_number.status_code == 422
    assert invalid_number.json()["detail"]["errors"][number["id"]] == "Enter a number no greater than 10."

    partial = client.post(f"/api/public/forms/{slug}/partials", json={"answers": {email["id"]: "person@example.com"}})
    assert partial.status_code == 200
    partial_id = partial.json()["partial_id"]
    completion = client.get(f"/api/forms/{form['id']}/completion")
    assert completion.json() == {"started": 1, "completed": 0, "partial": 1, "completion_rate": 0}

    submitted = client.post(
        f"/api/public/forms/{slug}/responses",
        json={"partial_id": partial_id, "answers": {email["id"]: "person@example.com", number["id"]: 4}},
    )
    assert submitted.status_code == 201
    assert submitted.json()["response_id"]
    assert client.get(f"/api/forms/{form['id']}/completion").json() == {"started": 1, "completed": 1, "partial": 0, "completion_rate": 100}


def test_unpublished_forms_are_private_and_duplicate_copies_questions(client):
    form, (choice,) = create_form_with_questions(
        client,
        "Private source",
        [{"type": "multiple_choice", "title": "Pick one", "options": ["Alpha", "Beta"], "settings": {"allowOther": True}}],
    )
    assert client.get(f"/api/public/forms/{form['slug']}").status_code == 404

    copied = client.post(f"/api/forms/{form['id']}/duplicate")
    assert copied.status_code == 201
    copy = copied.json()
    assert copy["id"] != form["id"]
    assert copy["title"] == "Private source (copy)"
    assert copy["status"] == "draft"
    assert len(copy["questions"]) == 1
    assert copy["questions"][0]["id"] != choice["id"]
    assert copy["questions"][0]["options"] == ["Alpha", "Beta"]
    assert copy["questions"][0]["settings"] == {"allowOther": True}


def test_results_pagination_summary_and_csv_export_use_persisted_answers(client):
    form, (choice, number) = create_form_with_questions(
        client,
        "Exportable results",
        [
            {"type": "multiple_choice", "title": "Plan", "options": ["Free", "Pro"], "required": True},
            {"type": "number", "title": "Seats", "required": True},
        ],
    )
    published = publish(client, form["id"])
    for plan, seats in (("Free", 2), ("Pro", 6)):
        response = client.post(
            f"/api/public/forms/{published['slug']}/responses",
            json={"answers": {choice["id"]: plan, number["id"]: seats}},
        )
        assert response.status_code == 201

    listed = client.get(f"/api/forms/{form['id']}/responses?limit=1&offset=1")
    assert listed.status_code == 200
    assert listed.json()["total"] == 2
    assert len(listed.json()["items"]) == 1

    summary = client.get(f"/api/forms/{form['id']}/results/summary").json()
    choice_summary = next(item for item in summary["questions"] if item["question_id"] == choice["id"])
    number_summary = next(item for item in summary["questions"] if item["question_id"] == number["id"])
    assert choice_summary["choice_counts"] == [
        {"value": "Free", "count": 1, "percentage": 50.0},
        {"value": "Pro", "count": 1, "percentage": 50.0},
    ]
    assert number_summary["average"] == 4.0
    assert number_summary["minimum"] == 2.0
    assert number_summary["maximum"] == 6.0

    exported = client.get(f"/api/forms/{form['id']}/export/responses.csv")
    assert exported.status_code == 200
    assert exported.headers["content-type"].startswith("text/csv")
    rows = list(csv.reader(io.StringIO(exported.text)))
    assert rows[0] == ["response_id", "submitted_at", "Plan", "Seats"]
    assert {tuple(row[2:]) for row in rows[1:]} == {("Free", "2"), ("Pro", "6")}
