"""Human review gate for a real Mars bundle. Not independent scientific certification.

This requires preserved evidence that one *actually used* dataset appears in the
2026 challenge's official Resources tab. DO NOT run against synthetic fixtures.
"""
from __future__ import annotations
import argparse
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path


def approve(bundle_path: Path, reviewer: str, official_resource_url: str,
            resources_capture: Path, note: str, confirm: bool = False) -> dict:
    path=bundle_path/'manifest.json'
    m=json.loads(path.read_text())
    if m.get('status')!='SOURCE_REVIEW_REQUIRED' or m.get('sourceId') in ('SYNTHETIC_INTEGRATION_FIXTURE_01','LOCAL_DEM_PROVENANCE_PENDING'):
        raise ValueError('Cannot approve synthetic or unproven source origin')
    if m.get('sourceFileProvenance') != 'DOWNLOADED_FROM_LISTED_HOST_SHA_MATCHED':
        raise ValueError('Originating DEM file must match recorded real download SHA')
    if m.get('planetaryBody')!='Mars' or not 3_000_000<float(m.get('sourceBodyRadiusMeters',0))<3_600_000:
        raise ValueError('Mars coordinate-frame review input missing')
    if not reviewer.strip() or len(note.strip())<30:
        raise ValueError('Require named reviewer and meaningful independent projection/coverage review notes')
    if not official_resource_url.startswith('https://'):
        raise ValueError('Official Resources entry URL must be HTTPS')
    if not resources_capture.is_file() or resources_capture.stat().st_size < 100:
        raise ValueError('Save an actual screenshot or PDF export of the challenge Resources listing')
    points=[t for t in m.get('scienceTargets',[]) if t['location']['confidence']=='VERIFIED_POINT']
    if len(points)<2:
        raise ValueError('At least two independently source-backed exact targets are required before promotion')
    if not all(t['science'].get('evidence') and t['location']['locationSource'] for t in points):
        raise ValueError('Every precise target must link to scientific and coordinate evidence')
    for name,record in m.get('files',{}).items():
        f=bundle_path/name
        if not f.exists() or f.stat().st_size!=record['bytes'] or hashlib.sha256(f.read_bytes()).hexdigest()!=record['sha256']:
            raise ValueError(f'Integrity error: {name}')
    im=bundle_path/m['imagery']['path']
    if not im.exists() or hashlib.sha256(im.read_bytes()).hexdigest()!=m['imagery']['sha256']:
        raise ValueError('Imagery hash does not match expected bundle')
    if not confirm:
        raise ValueError('Run with explicit --confirm after the recorded resource and Mars-frame review')
    m['status']='VERIFIED'
    m['coordinateFrameVerified']=True
    m['challengeResourceQualified']=True
    m['reviewRecord']={
        'reviewer':reviewer,'timeUTC':datetime.now(timezone.utc).isoformat(),
        'scope':'Team-reviewed evidence + actual source appearance in official challenge Resources, not NASA certification',
        'officialResourceEntry':official_resource_url,
        'resourcesCaptureSha256':hashlib.sha256(resources_capture.read_bytes()).hexdigest(),
        'resourcesCaptureFile':resources_capture.name,
        'coordinateAndTargetReviewNotes':note,
    }
    path.write_text(json.dumps(m,indent=2)+'\n')
    return m

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--bundle',type=Path,default=Path('public/data'))
    p.add_argument('--reviewer',required=True)
    p.add_argument('--official-resource-url',required=True)
    p.add_argument('--resources-capture',type=Path,required=True)
    p.add_argument('--notes',required=True)
    p.add_argument('--confirm',action='store_true')
    args=p.parse_args()
    m=approve(args.bundle,args.reviewer,args.official_resource_url,args.resources_capture,args.notes,args.confirm)
    print('TEAM-REVIEWED bundle:',m['sourceId'],'targets:',len(m['scienceTargets']))
    print('This gate records human review, not NASA approval or astronaut safety certification.')
