// pages/api/test-redis.js
import redis from '../../lib/redis';

export default async function handler(req, res) {
  try {
    // Test setting a key-value pair in Redis
    await redis.set('testkey', 'Hello from Redis!', 'EX', 3600); // Cache for 1 hour

    // Test getting the key from Redis
    const value = await redis.get('testkey');

    if (value) {
      res.status(200).json({ message: 'Redis test successful', value });
    } else {
      res.status(404).json({ message: 'Redis test failed' });
    }
  } catch (err) {
    res.status(500).json({ error: 'Error connecting to Redis', details: err.message });
  }
}
