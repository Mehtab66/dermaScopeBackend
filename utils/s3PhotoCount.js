/**
 * Count photo objects in S3 under a given prefix (e.g. clinician folder).
 * Uses same sanitization as frontend so prefix matches mobile app uploads.
 * Only counts keys that look like files (not directory placeholders: no trailing /, size > 0).
 */

const { S3Client, ListObjectsV2Command } = require('@aws-sdk/client-s3');

const bucket = process.env.AWS_S3_BUCKET || 'cutiscope';
const region = process.env.AWS_REGION || 'ap-south-1';

function getS3Client() {
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
    if (!accessKeyId || !secretAccessKey) return null;
    return new S3Client({
        region,
        credentials: { accessKeyId, secretAccessKey },
    });
}

/** Match frontend ImageUploader: sanitize for S3 folder name */
function sanitizeForS3(name) {
    if (!name || typeof name !== 'string') return '';
    return name
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, '')
        .substring(0, 50);
}

/**
 * Count objects under prefix that are real files (not directory markers, size > 0).
 * Paginates through ListObjectsV2.
 */
async function countPhotosUnderPrefix(s3Client, prefix) {
    if (!prefix || !prefix.endsWith('/')) prefix = prefix ? `${prefix}/` : '';
    let total = 0;
    let continuationToken;
    do {
        const command = new ListObjectsV2Command({
            Bucket: bucket,
            Prefix: prefix,
            MaxKeys: 1000,
            ...(continuationToken && { ContinuationToken: continuationToken }),
        });
        const response = await s3Client.send(command);
        const contents = response.Contents || [];
        for (const obj of contents) {
            if (obj.Key && !obj.Key.endsWith('/') && (obj.Size == null || obj.Size > 0)) {
                total += 1;
            }
        }
        continuationToken = response.NextContinuationToken || null;
    } while (continuationToken);
    return total;
}

/**
 * Get total photo count for a clinician from S3.
 * Tries both sanitized and raw email prefix; returns the larger count to cover both naming conventions.
 */
async function getPhotoCountForUser(emailOrUsername) {
    const s3 = getS3Client();
    if (!s3) return 0;
    const sanitized = sanitizeForS3(emailOrUsername);
    const raw = (emailOrUsername || '').trim();
    const prefixes = [];
    if (sanitized) prefixes.push(sanitized);
    if (raw && raw !== sanitized) prefixes.push(raw);
    if (prefixes.length === 0) return 0;
    let total = 0;
    const seen = new Set();
    for (const p of prefixes) {
        const prefix = p.endsWith('/') ? p : `${p}/`;
        if (seen.has(prefix)) continue;
        seen.add(prefix);
        try {
            const n = await countPhotosUnderPrefix(s3, prefix);
            total += n;
        } catch (err) {
            console.warn('S3 count for prefix', prefix, err.message);
        }
    }
    return total;
}

module.exports = { getPhotoCountForUser, sanitizeForS3 };
