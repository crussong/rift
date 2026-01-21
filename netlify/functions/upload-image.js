// Netlify Function: Image Upload Proxy
// Uploads images to catbox.moe to avoid CORS issues

const fetch = require('node-fetch');
const FormData = require('form-data');

exports.handler = async (event) => {
    // Only allow POST
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        // Get the base64 image from request body
        const { image, filename, contentType } = JSON.parse(event.body);
        
        if (!image) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'No image provided' })
            };
        }

        // Convert base64 to buffer
        const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');

        // Create form data for catbox.moe
        const formData = new FormData();
        formData.append('reqtype', 'fileupload');
        formData.append('fileToUpload', buffer, {
            filename: filename || 'image.jpg',
            contentType: contentType || 'image/jpeg'
        });

        // Upload to catbox.moe
        const response = await fetch('https://catbox.moe/user/api.php', {
            method: 'POST',
            body: formData,
            headers: formData.getHeaders()
        });

        const result = await response.text();

        if (result && result.startsWith('https://')) {
            return {
                statusCode: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({ url: result.trim() })
            };
        } else {
            return {
                statusCode: 500,
                body: JSON.stringify({ error: 'Upload failed', details: result })
            };
        }

    } catch (error) {
        console.error('Upload error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Upload failed', details: error.message })
        };
    }
};
