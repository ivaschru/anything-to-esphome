#!/usr/bin/env python3
"""Build a private, version-bound Monitor 1 update using the ordinary builder."""
import argparse
import json
import os
from pathlib import Path
import subprocess
import sys

from build_candidate import HERE, read_profile, release_line


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--profile", required=True, type=Path)
    parser.add_argument("--qt-core", required=True, type=Path)
    parser.add_argument("--source-ref", required=True)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--qt-archive", type=Path)
    parser.add_argument("--openssl-archive", type=Path)
    args = parser.parse_args()
    profile, profile_sha = read_profile(args.profile)
    if len(args.source_ref) != 40 or any(value not in "0123456789abcdef" for value in args.source_ref):
        parser.error("--source-ref must be the exact published commit SHA")
    subprocess.run([sys.executable, str(HERE / "build_candidate.py"), *sys.argv[1:]], check=True)

    # Keep the original initial-install builder and its source pin intact.
    # The update report uses the release numbers in the actual archived
    # source, which also generated the matching native and bridge projects.
    report_path = args.output / "result.json"
    report = json.loads(report_path.read_text())
    if (report.get("complete_build") is not True or report.get("source_commit") != args.source_ref
            or report.get("profile_sha256") != profile_sha):
        raise RuntimeError("The completed candidate did not match the requested source and profile")
    line, version = release_line(args.output / "ports/monitor1", profile)
    report["runtime_release"] = {"profile": line, "public_version": version}
    temporary = report_path.with_suffix(".update-tmp")
    fd = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
    with os.fdopen(fd, "w") as stream:
        json.dump(report, stream, indent=2)
        stream.write("\n")
        stream.flush()
        os.fsync(stream.fileno())
    os.replace(temporary, report_path)


if __name__ == "__main__":
    main()
