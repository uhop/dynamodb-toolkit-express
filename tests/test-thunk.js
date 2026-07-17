import test from 'tape-six';

import * as thunk from 'dynamodb-toolkit-express';
import * as core from 'dynamodb-toolkit/express';

test('thunk: re-exports the dynamodb-toolkit/express surface verbatim', t => {
  t.deepEqual(Object.keys(thunk).sort(), Object.keys(core).sort(), 'same export surface');
  for (const key of Object.keys(core)) {
    t.equal(thunk[key], core[key], `same identity: ${key}`);
  }
});
