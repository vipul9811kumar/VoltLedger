import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deriveProvenance } from './provenance';
import type { DataSource } from '@voltledger/db';

const cases: Array<[DataSource, 'REAL_ANCHORED' | 'SIMULATED_CALIBRATED']> = [
  ['OEM_API', 'REAL_ANCHORED'],
  ['MQTT_TELEMATICS', 'REAL_ANCHORED'],
  ['MANUAL_UPLOAD', 'REAL_ANCHORED'],
  ['AUCTION_SCAN', 'REAL_ANCHORED'],
  ['EU_PASSPORT', 'REAL_ANCHORED'],
  ['SYNTHETIC', 'SIMULATED_CALIBRATED'],
];

for (const [dataSource, expected] of cases) {
  test(`${dataSource} -> ${expected}`, () => {
    assert.equal(deriveProvenance(dataSource), expected);
  });
}
