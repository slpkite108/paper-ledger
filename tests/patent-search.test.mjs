import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'vite';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
await build({ configFile: false, logLevel: 'silent', build: { outDir: '.build/patent-search-test', emptyOutDir: false, target: 'esnext', lib: { entry: resolve('src/lib/patent-search.ts'), formats: ['es'], fileName: () => 'app.mjs' } } });
const { emptyPatentQuery, patentSearchExpression } = await import(pathToFileURL(resolve('.build/patent-search-test/app.mjs')).href);
const expression = fields => patentSearchExpression({ ...emptyPatentQuery, ...fields });
test('patent search scopes names and titles to their respective fields and combines with AND', () => {
  assert.deepEqual(expression({ inventor: ' 홍길동 ', applicant: '대학교  산학협력단', title: '연합 학습' }), { expression: 'IN=[홍길동]*AP=[대학교 산학협력단]*TL=[연합 학습]', error: '' });
});
test('patent search normalizes domestic application numbers without broadening invalid input', () => {
  assert.equal(expression({ applicationNumber: '10-2022-0086672' }).expression, 'AN=[1020220086672]');
  assert.equal(expression({ applicationNumber: '2019990028103' }).expression, 'AN=[2019990028103]');
  for (const value of ['123', 'KR1020220086672', '3020220086672', '1020220086672*']) assert.ok(expression({ applicationNumber: value }).error);
});
test('empty and operator-bearing input cannot issue a different or unbounded search', () => {
  assert.ok(expression({}).error);
  for (const value of ['이름]*AP=[다른기관', '김*', '이름+이름', 'a'.repeat(201)]) {
    assert.ok(expression({ inventor: value }).error);
    assert.equal(expression({ inventor: value }).expression, '');
  }
});
