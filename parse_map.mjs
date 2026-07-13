import fs from 'fs';
import { SourceMapConsumer } from 'source-map';

const map = JSON.parse(fs.readFileSync('dist/assets/index-l2jDyN68.js.map', 'utf8'));

SourceMapConsumer.with(map, null, consumer => {
  const pos = consumer.originalPositionFor({
    line: 150,
    column: 18496
  });
  console.log(pos);
});
