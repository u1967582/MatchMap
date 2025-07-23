/**
 * Test utility to verify base64 to Blob conversion works correctly
 */
export const testBlobConversion = (base64: string): boolean => {
  try {
    console.log('🧪 Testing base64 to Blob conversion...');
    console.log(`📊 Input base64 length: ${base64.length} characters`);

    // Test the conversion process
    const binaryString = atob(base64);
    console.log(`🔄 Binary string length: ${binaryString.length} characters`);

    const uint8Array = Uint8Array.from(binaryString, c => c.charCodeAt(0));
    console.log(`🔢 Uint8Array length: ${uint8Array.length} bytes`);

    const blob = new Blob([uint8Array], { type: 'image/jpeg' });
    console.log(`📦 Blob size: ${blob.size} bytes, type: ${blob.type}`);

    // Verify blob is not empty
    if (blob.size === 0) {
      console.error('❌ Blob conversion failed: size is 0');
      return false;
    }

    // Verify blob type is correct
    if (blob.type !== 'image/jpeg') {
      console.error(`❌ Blob type incorrect: expected 'image/jpeg', got '${blob.type}'`);
      return false;
    }

    console.log('✅ Blob conversion test passed!');
    return true;
  } catch (error) {
    console.error('❌ Blob conversion test failed:', error);
    return false;
  }
};

/**
 * Test with a minimal valid base64 image (1x1 pixel transparent PNG)
 */
export const testWithSampleImage = (): boolean => {
  // 1x1 pixel transparent PNG in base64
  const sampleBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAI/hcDVQwAAAABJRU5ErkJggg==';
  
  console.log('🧪 Testing with sample 1x1 pixel image...');
  return testBlobConversion(sampleBase64);
};

/**
 * Create a Blob from base64 string (the actual function used in upload)
 */
export const createBlobFromBase64 = (base64: string, contentType: string = 'image/jpeg'): Blob => {
  try {
    const blob = new Blob([Uint8Array.from(atob(base64), c => c.charCodeAt(0))], {
      type: contentType,
    });
    
    console.log(`📦 Created blob: ${blob.size} bytes, type: ${blob.type}`);
    return blob;
  } catch (error) {
    console.error('❌ Error creating blob from base64:', error);
    throw new Error('Failed to create blob from base64');
  }
}; 