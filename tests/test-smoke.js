import test from 'tape-six';

test('smoke: package loads', async t => {
  const pkg = await import('dynamodb-toolkit-express');
  t.ok(pkg, 'package resolves');
});
