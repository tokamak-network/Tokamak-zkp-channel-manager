'use client';

import { useState, useRef } from 'react';
import { useAccount } from 'wagmi';
import { X, Upload, FileArchive, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
// Using API route to avoid CORS issues
import { getData, updateData, setData } from '@/lib/realtime-db-helpers';
import JSZip from 'jszip';

interface SubmitProofModalProps {
  isOpen: boolean;
  onClose: () => void;
  channelId: number;
  onUploadSuccess?: () => void; // Callback when upload completes successfully
}

export function SubmitProofModal({ isOpen, onClose, channelId, onUploadSuccess }: SubmitProofModalProps) {
  const { address } = useAccount();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Validate ZIP file structure - check for required files within 2 levels of depth
  const validateProofZip = async (file: File): Promise<string | null> => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const zip = await JSZip.loadAsync(arrayBuffer);

      // Get all files (not directories) within 2 levels of depth
      // Depth 0: file.json
      // Depth 1: folder/file.json
      // Depth 2: folder/folder/file.json
      const MAX_DEPTH = 2;
      const allFiles = Object.keys(zip.files).filter(name => {
        if (name.endsWith('/')) return false; // Skip directories
        const normalized = name.replace(/\\/g, '/');
        const depth = normalized.split('/').length - 1; // Count folder depth
        return depth <= MAX_DEPTH;
      });

      // Helper function to find file by name
      const findFile = (fileName: string): string | undefined => {
        return allFiles.find(name => {
          const normalized = name.replace(/\\/g, '/').toLowerCase();
          const fn = normalized.split('/').pop();
          return fn === fileName.toLowerCase();
        });
      };

      // 1. Check instance.json
      const instancePath = findFile('instance.json');
      if (!instancePath) {
        return 'Missing required file: instance.json (must be within 2 folder levels)';
      }
      const instanceFile = zip.file(instancePath);
      if (!instanceFile) {
        return 'Could not read instance.json';
      }
      try {
        const instanceContent = await instanceFile.async('string');
        const instanceData = JSON.parse(instanceContent);
        
        if (!instanceData.a_pub_user || !Array.isArray(instanceData.a_pub_user)) {
          return 'Invalid instance.json: missing or invalid "a_pub_user" array';
        }
        if (!instanceData.a_pub_block || !Array.isArray(instanceData.a_pub_block)) {
          return 'Invalid instance.json: missing or invalid "a_pub_block" array';
        }
        if (!instanceData.a_pub_function || !Array.isArray(instanceData.a_pub_function)) {
          return 'Invalid instance.json: missing or invalid "a_pub_function" array';
        }
      } catch (parseError) {
        return `Invalid instance.json: ${parseError instanceof Error ? parseError.message : 'Parse error'}`;
      }

      // 2. Check proof.json
      const proofPath = findFile('proof.json');
      if (!proofPath) {
        return 'Missing required file: proof.json (must be within 2 folder levels)';
      }
      const proofFile = zip.file(proofPath);
      if (!proofFile) {
        return 'Could not read proof.json';
      }
      try {
        const proofContent = await proofFile.async('string');
        const proofData = JSON.parse(proofContent);
        
        if (!proofData.proof_entries_part1 || !Array.isArray(proofData.proof_entries_part1)) {
          return 'Invalid proof.json: missing or invalid "proof_entries_part1" array';
        }
        if (!proofData.proof_entries_part2 || !Array.isArray(proofData.proof_entries_part2)) {
          return 'Invalid proof.json: missing or invalid "proof_entries_part2" array';
        }
      } catch (parseError) {
        return `Invalid proof.json: ${parseError instanceof Error ? parseError.message : 'Parse error'}`;
      }

      // 3. Check state_snapshot.json
      const snapshotPath = findFile('state_snapshot.json');
      if (!snapshotPath) {
        return 'Missing required file: state_snapshot.json (must be within 2 folder levels)';
      }
      const snapshotFile = zip.file(snapshotPath);
      if (!snapshotFile) {
        return 'Could not read state_snapshot.json';
      }
      try {
        const snapshotContent = await snapshotFile.async('string');
        const snapshotData = JSON.parse(snapshotContent);
        
        if (typeof snapshotData.stateRoot !== 'string') {
          return 'Invalid state_snapshot.json: missing or invalid "stateRoot" field';
        }
        if (!snapshotData.registeredKeys || !Array.isArray(snapshotData.registeredKeys)) {
          return 'Invalid state_snapshot.json: missing or invalid "registeredKeys" array';
        }
        if (!snapshotData.storageEntries || !Array.isArray(snapshotData.storageEntries)) {
          return 'Invalid state_snapshot.json: missing or invalid "storageEntries" array';
        }
        if (typeof snapshotData.contractAddress !== 'string') {
          return 'Invalid state_snapshot.json: missing or invalid "contractAddress" field';
        }
      } catch (parseError) {
        return `Invalid state_snapshot.json: ${parseError instanceof Error ? parseError.message : 'Parse error'}`;
      }

      // All validations passed
      return null;
    } catch (error) {
      return `Failed to validate ZIP file: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      // Check if file is a ZIP file
      if (!selectedFile.name.toLowerCase().endsWith('.zip')) {
        setError('Please select a ZIP file');
        return;
      }

      // Validate ZIP structure and content
      setError('Validating file structure...');
      const validationError = await validateProofZip(selectedFile);
      
      if (validationError) {
        setError(validationError);
        return;
      }

      setFile(selectedFile);
      setError(null);
      setSuccess(false);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError('No file selected');
      return;
    }

    setUploading(true);
    setError(null);
    setUploadProgress(0);

    try {
      // Step 1: Get next proof number atomically from backend
      // SECURITY: This calculation is now performed on the backend to prevent
      // race conditions when multiple users submit proofs simultaneously
      setUploadProgress(10);
      const proofNumberResponse = await fetch("/api/get-next-proof-number", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ channelId }),
      });

      if (!proofNumberResponse.ok) {
        const errorData = await proofNumberResponse.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to get next proof number");
      }

      const { proofNumber, subNumber, proofId, storageProofId } =
        await proofNumberResponse.json();
      
      // Step 2: Upload ZIP file to Firebase Storage
      // SECURITY: storagePath is now constructed on the server-side
      setUploadProgress(30);
      const formData = new FormData();
      formData.append('file', file);
      formData.append('channelId', channelId.toString());
      formData.append('proofId', storageProofId);
      
      const uploadResponse = await fetch('/api/save-proof-zip', {
        method: 'POST',
        body: formData,
      });
      
      if (!uploadResponse.ok) {
        const errorData = await uploadResponse.json().catch(() => ({}));
        const errorMessage = errorData.error || errorData.details || 'Upload failed';
        throw new Error(errorMessage);
      }
      
      const { path, size } = await uploadResponse.json();
      setUploadProgress(90);
      
      // Step 3: Save metadata to Firebase Realtime Database
      // IMPORTANT: Don't include zipFile object to avoid overwriting zipFile.content
      // The zipFile.content was already saved by /api/save-proof-zip
      const proofMetadata = {
        proofId: proofId,
        sequenceNumber: proofNumber,
        subNumber: subNumber,
        submittedAt: new Date().toISOString(),
        submitter: address || '',
        timestamp: Date.now(),
        uploadStatus: 'complete',
        status: 'pending',
        channelId: channelId.toString(),
      };
      
      // Use updateData to merge with existing data (preserves zipFile.content)
      await updateData(`channels/${channelId}/submittedProofs/${storageProofId}`, proofMetadata);
      
      // Update zipFile metadata fields individually to preserve content
      await updateData(`channels/${channelId}/submittedProofs/${storageProofId}/zipFile`, {
        fileName: file.name,
        size: size,
        path: path,
      });
      
      setUploadProgress(100);
      setSuccess(true);
      setUploading(false);
      
      // Notify parent component of successful upload
      if (onUploadSuccess) {
        onUploadSuccess();
      }
      
      // Reset after 3 seconds
      setTimeout(() => {
        handleClose();
      }, 3000);
    } catch (err) {
      console.error('Upload error:', err);
      setError(err instanceof Error ? err.message : 'Upload failed');
      setUploading(false);
    }
  };

  const handleClose = () => {
    if (!uploading) {
      setFile(null);
      setError(null);
      setSuccess(false);
      setUploadProgress(0);
      setUploadedUrl(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      onClose();
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      if (!droppedFile.name.toLowerCase().endsWith('.zip')) {
        setError('Please drop a ZIP file');
        return;
      }

      // Validate ZIP structure and content
      setError('Validating file structure...');
      const validationError = await validateProofZip(droppedFile);
      
      if (validationError) {
        setError(validationError);
        return;
      }

      setFile(droppedFile);
      setError(null);
      setSuccess(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-gradient-to-b from-[#1a2347] to-[#0a1930] border border-[#4fc3f7] rounded-lg shadow-xl shadow-[#4fc3f7]/20 w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[#4fc3f7]/30">
          <div className="flex items-center gap-3">
            <div className="bg-[#4fc3f7] p-2 rounded">
              <FileArchive className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">Submit Proof</h2>
              <p className="text-sm text-gray-400">Channel #{channelId}</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={uploading}
            className="text-gray-400 hover:text-white transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {success ? (
            <div className="text-center py-8">
              <div className="bg-green-500/20 border border-green-500/50 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-8 h-8 text-green-400" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Upload Successful!</h3>
              <p className="text-gray-400 text-sm mb-4">
                Your proof files have been uploaded to Firebase Storage.
              </p>
              {uploadedUrl && (
                <p className="text-xs text-[#4fc3f7] break-all">
                  {uploadedUrl}
                </p>
              )}
            </div>
          ) : (
            <>
              {/* File Drop Zone */}
              <div
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-all ${
                  file
                    ? 'border-[#4fc3f7] bg-[#4fc3f7]/5'
                    : 'border-[#4fc3f7]/30 hover:border-[#4fc3f7]/50'
                }`}
              >
                {file ? (
                  <div className="space-y-3">
                    <FileArchive className="w-12 h-12 text-[#4fc3f7] mx-auto" />
                    <div>
                      <p className="text-white font-medium">{file.name}</p>
                      <p className="text-gray-400 text-sm">
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setFile(null);
                        if (fileInputRef.current) {
                          fileInputRef.current.value = '';
                        }
                      }}
                      className="text-sm text-red-400 hover:text-red-300"
                      disabled={uploading}
                    >
                      Remove file
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <Upload className="w-12 h-12 text-[#4fc3f7] mx-auto" />
                    <div>
                      <p className="text-white font-medium mb-1">
                        Drop ZIP file here or click to browse
                      </p>
                      <p className="text-gray-400 text-sm">
                        Upload proof files as a ZIP archive
                      </p>
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".zip"
                      onChange={handleFileSelect}
                      className="hidden"
                      id="file-upload"
                    />
                    <label
                      htmlFor="file-upload"
                      className="inline-block px-4 py-2 bg-[#4fc3f7] hover:bg-[#029bee] text-white rounded cursor-pointer transition-colors"
                    >
                      Select ZIP File
                    </label>
                  </div>
                )}
              </div>

              {/* Error Message */}
              {error && (
                <div className="mt-4 bg-red-500/10 border border-red-500/30 p-3 rounded flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              )}

              {/* Upload Progress */}
              {uploading && (
                <div className="mt-4 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400">Uploading...</span>
                    <span className="text-[#4fc3f7]">{Math.round(uploadProgress)}%</span>
                  </div>
                  <div className="w-full bg-[#0a1930] rounded-full h-2">
                    <div
                      className="bg-[#4fc3f7] h-2 rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3 mt-6">
                <button
                  onClick={handleClose}
                  disabled={uploading}
                  className="flex-1 px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleUpload();
                  }}
                  type="button"
                  disabled={!file || uploading}
                  className="flex-1 px-4 py-2 bg-[#4fc3f7] hover:bg-[#029bee] text-white rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer pointer-events-auto"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      Upload
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}



