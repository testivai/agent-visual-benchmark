import { test } from 'node:test';
import assert from 'node:assert/strict';
import { imageAnswer, IMAGE_FACTS } from './image-check.mjs';

test('the answer must name the colour and the number that are only in the picture', () => {
  assert.deepEqual(IMAGE_FACTS, { colour: 'purple', number: 47 });
  assert.deepEqual(imageAnswer('I looked at it.\nANSWER: purple, 47'), { answer: 'purple, 47', pass: true });
  assert.equal(imageAnswer('ANSWER: Violet, 47.').pass, true);
  assert.equal(imageAnswer('ANSWER: purple, 41').pass, false);
  assert.equal(imageAnswer('ANSWER: blue, 47').pass, false);
  assert.equal(imageAnswer('The circle is purple with 47 in it.').pass, false, 'no ANSWER line: no answer');
  assert.equal(imageAnswer('ANSWER: I cannot see images').pass, false);
});
