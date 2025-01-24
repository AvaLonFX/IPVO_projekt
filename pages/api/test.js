import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: 'https://generous-jawfish-45569.upstash.io',
  token: 'AbIBAAIjcDFkYjM2NDgyZDlkNzE0YzIyOGJkMGE5MGY5YzM5YzUxMXAxMA',
})

await redis.set('foo', 'bar');
const data = await redis.get('foo');