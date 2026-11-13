"""Directed terrain travel fields; times are nominal minutes at 1.0× speed.

Inputs must be an accepted, north-up, locally metric Mars analysis raster.
All a/b/v/slope numbers are named scenario assumptions, NOT astronaut certification.
"""
from __future__ import annotations

from dataclasses import asdict, dataclass
from pathlib import Path
import hashlib
import json
import math

import numpy as np
from scipy.sparse import csr_matrix
from scipy.sparse.csgraph import dijkstra


@dataclass(frozen=True)
class TerrainScenario:
    model_id: str = 'terrain-scenario-v0'
    reference_speed_mps: float = 0.75
    uphill_coefficient: float = 4.0
    downhill_coefficient: float = 1.8
    max_slope_degrees: float = 25.0
    connectivity: int = 8
    evidence_status: str = 'SCENARIO_ASSUMPTION'


def _validate_inputs(z: np.ndarray, mask: np.ndarray, dx: float, dy: float,
                     base: tuple[int, int], model: TerrainScenario) -> None:
    if z.ndim != 2 or z.shape != mask.shape or z.size == 0:
        raise ValueError('Elevation and mask must be aligned, nonempty 2D arrays')
    if not (math.isfinite(dx) and dx > 0 and math.isfinite(dy) and dy > 0):
        raise ValueError('dx/dy must be strictly positive metric distances')
    if model.connectivity not in (4, 8):
        raise ValueError('Connectivity must be 4 or 8')
    if not all(math.isfinite(v) for v in (model.reference_speed_mps,
                model.uphill_coefficient, model.downhill_coefficient, model.max_slope_degrees)):
        raise ValueError('Nonfinite terrain parameter')
    if model.reference_speed_mps <= 0 or model.uphill_coefficient <= model.downhill_coefficient or model.downhill_coefficient < 0:
        raise ValueError('Invalid model speed/grade penalty')
    if not (0 < model.max_slope_degrees < 90):
        raise ValueError('Max slope must lie between 0 and 90°')
    if np.any(~np.isin(mask, (0, 1, 2))):
        raise ValueError('Mask must contain only UNKNOWN=0, VALID=1, HARD=2')
    if np.any(~np.isfinite(z[mask == 1])):
        raise ValueError('Valid cells cannot have nonfinite elevation')
    r, c = base
    if not (0 <= r < z.shape[0] and 0 <= c < z.shape[1]) or mask[r, c] != 1:
        raise ValueError('Base must be a VALID in-bounds cell')


def directed_adjacency(z: np.ndarray, mask: np.ndarray, dx: float, dy: float,
                       model: TerrainScenario) -> csr_matrix:
    """No edges through unknown/hard cells, no diagonal corner-cutting."""
    height, width = z.shape
    rows, cols, costs = [], [], []
    offsets = [(0, 1), (0, -1), (1, 0), (-1, 0)]
    if model.connectivity == 8:
        offsets += [(1, 1), (1, -1), (-1, 1), (-1, -1)]
    max_grade = math.tan(math.radians(model.max_slope_degrees))
    for r in range(height):
        for c in range(width):
            if mask[r, c] != 1: continue
            source = r * width + c
            for dr, dc in offsets:
                nr, nc = r + dr, c + dc
                if not (0 <= nr < height and 0 <= nc < width) or mask[nr, nc] != 1: continue
                if dr and dc and (mask[r + dr, c] != 1 or mask[r, c + dc] != 1): continue
                distance_m = math.hypot(dr * dy, dc * dx)
                grade = (float(z[nr, nc]) - float(z[r, c])) / distance_m
                if abs(grade) > max_grade: continue
                multiplier = 1.0 + model.uphill_coefficient * max(grade, 0) + model.downhill_coefficient * max(-grade, 0)
                minutes = distance_m * multiplier / model.reference_speed_mps / 60.0
                if not (math.isfinite(minutes) and minutes > 0): raise ValueError('Invalid edge cost')
                rows.append(source); cols.append(nr * width + nc); costs.append(minutes)
    return csr_matrix((np.asarray(costs, dtype=np.float64),
                      (np.asarray(rows, dtype=np.int32), np.asarray(cols, dtype=np.int32))),
                      shape=(height * width, height * width), dtype=np.float64)


def compute_route_fields(z: np.ndarray, mask: np.ndarray, dx: float, dy: float,
                         base: tuple[int, int], model: TerrainScenario = TerrainScenario()) -> dict:
    z = np.asarray(z, dtype=np.float64)
    mask = np.asarray(mask, dtype=np.uint8)
    _validate_inputs(z, mask, dx, dy, base, model)
    base_index = base[0] * z.shape[1] + base[1]
    graph = directed_adjacency(z, mask, dx, dy, model)
    outbound_cost, outbound_parents = dijkstra(graph, directed=True, indices=base_index, return_predecessors=True)
    return_cost, return_next = dijkstra(graph.transpose().tocsr(), directed=True, indices=base_index, return_predecessors=True)
    normalise = lambda x: np.where(x == -9999, -1, x).astype('<i4')
    return {
        'outbound-costs.bin': np.asarray(outbound_cost, dtype='<f8'),
        'return-costs.bin': np.asarray(return_cost, dtype='<f8'),
        'outbound-parents.bin': normalise(outbound_parents),
        'return-next.bin': normalise(return_next),
        'elevation.bin': z.astype('<f4').ravel(order='C'),
        'validity-mask.bin': mask.astype('u1').ravel(order='C'),
        '_base_index': base_index,
        '_model': asdict(model),
        '_shape': list(z.shape),
        '_edge_count': int(graph.nnz),
    }


def export_fields(fields: dict, output_dir: Path) -> dict:
    output_dir.mkdir(parents=True, exist_ok=True)
    records = {}
    for key, array in fields.items():
        if not key.endswith('.bin'): continue
        data = array.tobytes(order='C')
        (output_dir / key).write_bytes(data)
        records[key] = {'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest(), 'dtype': str(array.dtype)}
    (output_dir / 'grid.meta.json').write_text(json.dumps({
        'schemaVersion': '1.0.0', 'shape': fields['_shape'], 'baseIndex': fields['_base_index'],
        'edgeCount': fields['_edge_count'], 'model': fields['_model'], 'files': records,
    }, indent=2) + '\n')
    return records
