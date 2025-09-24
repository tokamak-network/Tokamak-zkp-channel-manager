'use client';

// Step 1: Add basic Button component
import { Button } from '@/components/ui/button';

export default function HomePage() {
  return (
    <div className="min-h-screen p-8">
      <h1 className="text-4xl font-bold text-blue-600 mb-4">
        Tokamak ZK Rollup Bridge
      </h1>
      <p className="text-lg text-gray-600 mb-8">
        Step 1: Testing Button component
      </p>
      
      <div className="space-y-4">
        <Button>Default Button</Button>
        <Button variant="outline">Outline Button</Button>
        <Button variant="gradient">Gradient Button</Button>
      </div>
    </div>
  );
}