"""JSON files written for the planner."""

import json


def write_json(path, document):
    path.write_text(json.dumps(document, indent=2) + "\n")
