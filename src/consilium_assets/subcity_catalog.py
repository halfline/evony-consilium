"""Pure subcity catalog rules from client configuration; no image rendering."""

from consilium_assets.config_protobuf import rows, value

CULTURES = ["Europe", "China", "Japan", "Korea", "America", "Russia", "Arabia"]
COLORS = ["white", "green", "blue", "purple", "gold"]


def subcity_requests(config, language):
    requests = []
    for culture_id, culture in enumerate(CULTURES, 1):
        for tier, color in enumerate(COLORS, 1):
            requests.append(
                {
                    "id": f"subcity-{culture.lower()}-{color}",
                    "name": culture,
                    "culture": culture,
                    "color": color,
                    "category": "culture",
                    "bundle": "map-castle-subcity",
                    "path": f"sprite/map/evony{culture_id}/subcity_lv{tier}.png",
                }
            )
    for record in rows(config / "FamousCityConfigure.bytes"):
        game_id = value(record, 101)
        name_key = value(record, 102)
        name = language.get(name_key, name_key)
        culture_id = value(record, 109)
        culture = (
            CULTURES[culture_id - 1]
            if 1 <= culture_id <= 7
            else name.removesuffix(" Famous City")
        )
        requests.append(
            {
                "id": f"famouscity-{game_id}",
                "name": name,
                "culture": culture,
                "color": "red",
                "category": "famous" if culture_id >= 10000 else "historic",
                "bundle": "map-sprite-famouscity",
                "path": value(record, 106).lower() + ".png",
            }
        )
    return requests
