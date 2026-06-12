import assert from 'node:assert/strict'
import { CUSTOM_POSITION_VALUE, getPositionTitleOptions, normalizePositionTitle } from './positionTitles.js'

assert.equal(normalizePositionTitle(' 팀장 '), '팀장')
assert.equal(normalizePositionTitle(null), '')
assert.equal(CUSTOM_POSITION_VALUE, '__custom_position__')

assert.deepEqual(
  getPositionTitleOptions(
    [{ position_name: ' 과장 ' }, { position_name: '팀장' }],
    [{ position_name: '사원' }, { positionName: '과장' }],
  ),
  ['대표', '관리자', '팀장', '직원', '과장', '사원'],
)
