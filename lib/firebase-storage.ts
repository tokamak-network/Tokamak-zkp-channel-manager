/**
 * Firebase Storage utilities for ZIP file uploads
 * 
 * Using Firebase Storage instead of Realtime Database for large files
 * significantly reduces bandwidth usage when listing proofs (metadata only is fetched,
 * not the entire file content).
 */

import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { app } from "./firebase";

// Get storage instance
const storage = getStorage(app);

export interface StorageUploadResult {
  storagePath: string;
  downloadUrl: string;
  fileName: string;
  size: number;
  uploadedAt: string;
}

/**
 * Upload a proof ZIP file to Firebase Storage
 * 
 * @param file - The ZIP file to upload
 * @param channelId - Channel ID
 * @param proofId - Proof ID (e.g., "proof_1_1")
 * @returns Storage path and download URL
 */
export async function uploadProofZipToStorage(
  file: File,
  channelId: string,
  proofId: string
): Promise<StorageUploadResult> {
  const storagePath = `channels/${channelId}/proofs/${proofId}/${file.name}`;
  const storageRef = ref(storage, storagePath);

  // Upload file
  const snapshot = await uploadBytes(storageRef, file, {
    contentType: "application/zip",
    customMetadata: {
      channelId,
      proofId,
      originalName: file.name,
    },
  });

  // Get download URL
  const downloadUrl = await getDownloadURL(snapshot.ref);

  return {
    storagePath,
    downloadUrl,
    fileName: file.name,
    size: file.size,
    uploadedAt: new Date().toISOString(),
  };
}

/**
 * Download a proof ZIP file from Firebase Storage
 * 
 * @param storagePath - The path in Firebase Storage
 * @returns The file as a Blob
 */
export async function downloadProofZipFromStorage(storagePath: string): Promise<Blob> {
  const storageRef = ref(storage, storagePath);
  const downloadUrl = await getDownloadURL(storageRef);
  
  const response = await fetch(downloadUrl);
  if (!response.ok) {
    throw new Error(`Failed to download file: ${response.statusText}`);
  }
  
  return response.blob();
}

/**
 * Get download URL for a proof ZIP file
 * 
 * @param storagePath - The path in Firebase Storage
 * @returns The download URL
 */
export async function getProofZipDownloadUrl(storagePath: string): Promise<string> {
  const storageRef = ref(storage, storagePath);
  return getDownloadURL(storageRef);
}

/**
 * Delete a proof ZIP file from Firebase Storage
 * 
 * @param storagePath - The path in Firebase Storage
 */
export async function deleteProofZipFromStorage(storagePath: string): Promise<void> {
  const storageRef = ref(storage, storagePath);
  await deleteObject(storageRef);
}

/**
 * Check if we should use Storage (new method) or Realtime DB (legacy)
 * 
 * @param zipFileData - The zipFile object from Firebase
 * @returns true if using Storage, false if legacy Realtime DB
 */
export function isUsingStorage(zipFileData: any): boolean {
  return !!zipFileData?.storagePath && !zipFileData?.content;
}

/**
 * Get ZIP file content - handles both Storage and legacy Realtime DB formats
 * 
 * @param zipFileData - The zipFile object from Firebase
 * @returns Base64 content string
 */
export async function getZipFileContent(zipFileData: any): Promise<string | null> {
  if (!zipFileData) return null;

  // Legacy: content stored directly in Realtime DB
  if (zipFileData.content) {
    return zipFileData.content;
  }

  // New: download from Storage
  if (zipFileData.storagePath) {
    try {
      const blob = await downloadProofZipFromStorage(zipFileData.storagePath);
      const arrayBuffer = await blob.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(arrayBuffer).reduce(
          (data, byte) => data + String.fromCharCode(byte),
          ""
        )
      );
      return base64;
    } catch (error) {
      console.error("Failed to download ZIP from Storage:", error);
      return null;
    }
  }

  return null;
}

