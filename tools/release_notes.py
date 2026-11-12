"""Extract the changelog entry for a GitHub release tag."""
import argparse
from pathlib import Path
import re


def release_notes(changelog: str, tag: str) -> str:
    """Find the exact version's level-two section and return its body."""
    version = tag.removeprefix("v")
    entries = []
    for section in re.split(r"^## +", changelog, flags=re.MULTILINE)[1:]:
        heading, _, body = section.partition("\n")
        if heading.split()[:1] == [version]:
            entries.append(body.strip())
    # A missing, duplicate or empty entry should stop the release. The release
    # and Marketplace already provide a version heading, so print the body only.
    if len(entries) != 1 or not entries[0]:
        raise ValueError(f"Expected one nonempty changelog entry for {tag}")
    return entries[0]


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("tag", help="GitHub release tag, for example v0.3.6")
    args = parser.parse_args()
    changelog = Path(__file__).resolve().parents[1] / "CHANGELOG.md"
    try:
        print(release_notes(changelog.read_text(encoding="utf-8"), args.tag))
    except ValueError as error:
        parser.exit(1, f"{error}\n")


if __name__ == "__main__":
    main()
