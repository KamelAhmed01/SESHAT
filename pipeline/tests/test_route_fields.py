"""Synthetic ORACLES ONLY, not measured NASA travel times."""
import numpy as np
import pytest
from pipeline.route_fields import TerrainScenario, compute_route_fields


def test_asymmetric_forward_and_reverse_paths():
    # At two cells 10m apart, uphill and downhill costs must differ.
    z = np.array([[0.0, 2.0]])
    fields = compute_route_fields(z, np.ones_like(z, dtype='u1'), 10, 10, (0, 0), TerrainScenario(connectivity=4))
    out = fields['outbound-costs.bin'][1]
    ret = fields['return-costs.bin'][1]
    assert out > ret > 0
    assert fields['outbound-parents.bin'].tolist() == [-1, 0]
    assert fields['return-next.bin'].tolist() == [-1, 0]
    assert out == pytest.approx(10 * (1 + 4 * 0.2) / 0.75 / 60)
    assert ret == pytest.approx(10 * (1 + 1.8 * 0.2) / 0.75 / 60)


def test_no_corner_cut():
    z = np.zeros((2, 2))
    mask = np.array([[1, 0], [0, 1]], dtype='u1')
    fields = compute_route_fields(z, mask, 10, 10, (0, 0))
    assert np.isinf(fields['outbound-costs.bin'][3])
    assert fields['outbound-parents.bin'][3] == -1


def test_unknown_never_is_a_route():
    z = np.zeros((1, 3))
    mask = np.array([[1, 0, 1]], dtype='u1')
    fields = compute_route_fields(z, mask, 10, 10, (0, 0))
    assert np.isinf(fields['outbound-costs.bin'][2])
    assert fields['validity-mask.bin'].tolist() == [1, 0, 1]


def test_slope_constraint_blocks_both_directions():
    z = np.array([[0.0, 10.0]])  # 45 deg for dx=10m, > 25° scenario limit
    fields = compute_route_fields(z, np.ones_like(z, dtype='u1'), 10, 10, (0, 0))
    assert np.isinf(fields['outbound-costs.bin'][1])
    assert np.isinf(fields['return-costs.bin'][1])


def test_base_index_zero_is_valid_and_endpoints_validate():
    fields = compute_route_fields(np.zeros((1, 2)), np.ones((1, 2), dtype='u1'), 20, 20, (0, 0))
    assert fields['_base_index'] == 0
    assert fields['outbound-costs.bin'][0] == 0
    with pytest.raises(ValueError):
        compute_route_fields(np.zeros((1, 2)), np.array([[0, 1]], dtype='u1'), 20, 20, (0, 0))


def test_eight_connectivity_metric_diagonal():
    z = np.zeros((2, 2))
    fields = compute_route_fields(z, np.ones_like(z, dtype='u1'), 10, 20, (0, 0))
    distance = np.hypot(10, 20)
    assert fields['outbound-costs.bin'][3] == pytest.approx(distance / 0.75 / 60)
