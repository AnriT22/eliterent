const bcrypt = require('bcryptjs');
const crypto = require('crypto');

// In-memory fallback if Redis is not available
const memoryStore = new Map();

let redisClient = null;

// Initialize Redis connection (optional - falls back to memory)
async function initRedis() {
    if (process.env.REDIS_URL) {
        try {
            const Redis = require('ioredis');
            redisClient = new Redis(process.env.REDIS_URL, {
                maxRetriesPerRequest: 3,
                retryDelayOnFailover: 100
            });
            redisClient.on('error', (err) => {
                console.error('Redis error:', err.message);
                redisClient = null;
            });
            await redisClient.ping();
            console.log('Redis connected for OTP storage');
            return true;
        } catch (err) {
            console.warn('Redis not available, using memory store for OTP:', err.message);
            redisClient = null;
            return false;
        }
    }
    console.log('REDIS_URL not set, using memory store for OTP');
    return false;
}

// Generate 6-digit OTP
function generateOTP() {
    return crypto.randomInt(100000, 999999).toString();
}

// Hash OTP for secure storage
async function hashOTP(otp) {
    return bcrypt.hash(otp, 10);
}

// Verify OTP against hash
async function verifyOTPHash(otp, hash) {
    return bcrypt.compare(otp, hash);
}

// Store OTP with expiration
async function storeOTP(key, otp, type, expiresInSeconds = 300) {
    const hash = await hashOTP(otp);
    const data = {
        hash,
        type,
        attempts: 0,
        createdAt: Date.now(),
        expiresAt: Date.now() + (expiresInSeconds * 1000)
    };

    if (redisClient) {
        await redisClient.setex(`otp:${key}`, expiresInSeconds, JSON.stringify(data));
    } else {
        memoryStore.set(`otp:${key}`, data);
        setTimeout(() => memoryStore.delete(`otp:${key}`), expiresInSeconds * 1000);
    }

    return data;
}

// Get OTP data
async function getOTP(key) {
    if (redisClient) {
        const data = await redisClient.get(`otp:${key}`);
        return data ? JSON.parse(data) : null;
    }
    return memoryStore.get(`otp:${key}`) || null;
}

// Increment attempt counter
async function incrementAttempts(key) {
    const data = await getOTP(key);
    if (!data) return null;

    data.attempts += 1;

    if (redisClient) {
        const ttl = await redisClient.ttl(`otp:${key}`);
        if (ttl > 0) {
            await redisClient.setex(`otp:${key}`, ttl, JSON.stringify(data));
        }
    } else {
        memoryStore.set(`otp:${key}`, data);
    }

    return data;
}

// Delete OTP
async function deleteOTP(key) {
    if (redisClient) {
        await redisClient.del(`otp:${key}`);
    } else {
        memoryStore.delete(`otp:${key}`);
    }
}

// Rate limiting for OTP requests
async function checkRateLimit(key, maxRequests = 5, windowSeconds = 60) {
    const rateLimitKey = `rate:${key}`;

    if (redisClient) {
        const count = await redisClient.incr(rateLimitKey);
        if (count === 1) {
            await redisClient.expire(rateLimitKey, windowSeconds);
        }
        return count <= maxRequests;
    }

    // Memory fallback
    const now = Date.now();
    const windowMs = windowSeconds * 1000;
    let entry = memoryStore.get(rateLimitKey);

    if (!entry || now - entry.start > windowMs) {
        entry = { count: 1, start: now };
        memoryStore.set(rateLimitKey, entry);
        setTimeout(() => memoryStore.delete(rateLimitKey), windowMs);
        return true;
    }

    entry.count += 1;
    return entry.count <= maxRequests;
}

// Check resend cooldown (60 seconds between resends)
async function checkResendCooldown(key, cooldownSeconds = 60) {
    const cooldownKey = `cooldown:${key}`;

    if (redisClient) {
        const exists = await redisClient.exists(cooldownKey);
        if (exists) {
            const ttl = await redisClient.ttl(cooldownKey);
            return { allowed: false, waitSeconds: ttl };
        }
        await redisClient.setex(cooldownKey, cooldownSeconds, '1');
        return { allowed: true, waitSeconds: 0 };
    }

    // Memory fallback
    const entry = memoryStore.get(cooldownKey);
    if (entry) {
        const remaining = Math.ceil((entry.expiresAt - Date.now()) / 1000);
        if (remaining > 0) {
            return { allowed: false, waitSeconds: remaining };
        }
    }

    memoryStore.set(cooldownKey, { expiresAt: Date.now() + (cooldownSeconds * 1000) });
    setTimeout(() => memoryStore.delete(cooldownKey), cooldownSeconds * 1000);
    return { allowed: true, waitSeconds: 0 };
}

// Block user after too many failed attempts
async function checkBlocked(key, blockDurationSeconds = 900) {
    const blockKey = `blocked:${key}`;

    if (redisClient) {
        const blocked = await redisClient.exists(blockKey);
        if (blocked) {
            const ttl = await redisClient.ttl(blockKey);
            return { blocked: true, remainingSeconds: ttl };
        }
        return { blocked: false, remainingSeconds: 0 };
    }

    const entry = memoryStore.get(blockKey);
    if (entry) {
        const remaining = Math.ceil((entry.expiresAt - Date.now()) / 1000);
        if (remaining > 0) {
            return { blocked: true, remainingSeconds: remaining };
        }
        memoryStore.delete(blockKey);
    }
    return { blocked: false, remainingSeconds: 0 };
}

// Block a user
async function blockUser(key, durationSeconds = 900) {
    const blockKey = `blocked:${key}`;

    if (redisClient) {
        await redisClient.setex(blockKey, durationSeconds, '1');
    } else {
        memoryStore.set(blockKey, { expiresAt: Date.now() + (durationSeconds * 1000) });
        setTimeout(() => memoryStore.delete(blockKey), durationSeconds * 1000);
    }
}

// Disposable email domains to block
const DISPOSABLE_DOMAINS = new Set([
    'tempmail.com', 'throwaway.email', 'guerrillamail.com', 'mailinator.com',
    '10minutemail.com', 'temp-mail.org', 'fakeinbox.com', 'trashmail.com',
    'yopmail.com', 'sharklasers.com', 'getnada.com', 'maildrop.cc',
    'dispostable.com', 'mailnesia.com', 'tempail.com', 'mohmal.com'
]);

function isDisposableEmail(email) {
    if (!email) return false;
    const domain = email.split('@')[1]?.toLowerCase();
    return DISPOSABLE_DOMAINS.has(domain);
}

module.exports = {
    initRedis,
    generateOTP,
    hashOTP,
    verifyOTPHash,
    storeOTP,
    getOTP,
    incrementAttempts,
    deleteOTP,
    checkRateLimit,
    checkResendCooldown,
    checkBlocked,
    blockUser,
    isDisposableEmail
};
