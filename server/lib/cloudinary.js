const https = require('https');
const crypto = require('crypto');

/**
 * Upload an image to Cloudinary
 * @param {string} base64Image - Base64 encoded image data (with or without data URI prefix)
 * @param {string} folder - Optional folder name in Cloudinary
 * @returns {Promise<{success: boolean, url?: string, public_id?: string, error?: string}>}
 */
const uploadToCloudinary = async (base64Image, folder = 'milkey') => {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (!cloudName || !apiKey || !apiSecret) {
        return {
            success: false,
            error: 'Cloudinary configuration is missing. Please set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.'
        };
    }

    try {
        // Clean base64 string (remove data URI prefix if present)
        let imageData = base64Image;
        if (base64Image.includes('base64,')) {
            imageData = base64Image.split('base64,')[1];
        }

        // Generate timestamp and signature for authenticated upload
        const timestamp = Math.round(new Date().getTime() / 1000);
        const paramsToSign = `folder=${folder}&timestamp=${timestamp}${apiSecret}`;
        const signature = crypto.createHash('sha1').update(paramsToSign).digest('hex');

        // Prepare form data
        const boundary = '----CloudinaryFormBoundary' + Date.now();
        const formData = [
            `--${boundary}`,
            'Content-Disposition: form-data; name="file"',
            '',
            `data:image/jpeg;base64,${imageData}`,
            `--${boundary}`,
            'Content-Disposition: form-data; name="api_key"',
            '',
            apiKey,
            `--${boundary}`,
            'Content-Disposition: form-data; name="timestamp"',
            '',
            timestamp.toString(),
            `--${boundary}`,
            'Content-Disposition: form-data; name="signature"',
            '',
            signature,
            `--${boundary}`,
            'Content-Disposition: form-data; name="folder"',
            '',
            folder,
            `--${boundary}--`
        ].join('\r\n');

        return new Promise((resolve) => {
            const options = {
                hostname: 'api.cloudinary.com',
                port: 443,
                path: `/v1_1/${cloudName}/image/upload`,
                method: 'POST',
                headers: {
                    'Content-Type': `multipart/form-data; boundary=${boundary}`,
                    'Content-Length': Buffer.byteLength(formData)
                }
            };

            const req = https.request(options, (res) => {
                let data = '';
                res.on('data', (chunk) => {
                    data += chunk;
                });
                res.on('end', () => {
                    try {
                        const result = JSON.parse(data);
                        if (result.secure_url) {
                            resolve({
                                success: true,
                                url: result.secure_url,
                                public_id: result.public_id
                            });
                        } else {
                            resolve({
                                success: false,
                                error: result.error?.message || 'Upload failed'
                            });
                        }
                    } catch (parseError) {
                        resolve({
                            success: false,
                            error: 'Failed to parse Cloudinary response'
                        });
                    }
                });
            });

            req.on('error', (error) => {
                resolve({
                    success: false,
                    error: error.message
                });
            });

            req.write(formData);
            req.end();
        });
    } catch (error) {
        return {
            success: false,
            error: error.message || 'Upload failed'
        };
    }
};

/**
 * Delete an image from Cloudinary
 * @param {string} publicId - The public_id of the image to delete
 * @returns {Promise<{success: boolean, error?: string}>}
 */
const deleteFromCloudinary = async (publicId) => {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (!cloudName || !apiKey || !apiSecret) {
        return {
            success: false,
            error: 'Cloudinary configuration is missing.'
        };
    }

    try {
        const timestamp = Math.round(new Date().getTime() / 1000);
        const paramsToSign = `public_id=${publicId}&timestamp=${timestamp}${apiSecret}`;
        const signature = crypto.createHash('sha1').update(paramsToSign).digest('hex');

        return new Promise((resolve) => {
            const postData = `public_id=${publicId}&api_key=${apiKey}&timestamp=${timestamp}&signature=${signature}`;

            const options = {
                hostname: 'api.cloudinary.com',
                port: 443,
                path: `/v1_1/${cloudName}/image/destroy`,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Content-Length': Buffer.byteLength(postData)
                }
            };

            const req = https.request(options, (res) => {
                let data = '';
                res.on('data', (chunk) => {
                    data += chunk;
                });
                res.on('end', () => {
                    try {
                        const result = JSON.parse(data);
                        resolve({
                            success: result.result === 'ok'
                        });
                    } catch {
                        resolve({ success: false, error: 'Failed to parse response' });
                    }
                });
            });

            req.on('error', (error) => {
                resolve({ success: false, error: error.message });
            });

            req.write(postData);
            req.end();
        });
    } catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
};

module.exports = {
    uploadToCloudinary,
    deleteFromCloudinary
};
