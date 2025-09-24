'use client';

// Step 2: Add Card components
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function HomePage() {
  return (
    <div className="min-h-screen p-8">
      <h1 className="text-4xl font-bold text-blue-600 mb-4">
        Tokamak ZK Rollup Bridge
      </h1>
      <p className="text-lg text-gray-600 mb-8">
        Step 2: Testing Card components
      </p>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Test Card 1</CardTitle>
          </CardHeader>
          <CardContent>
            <p>This is a test card with basic content.</p>
            <Button className="mt-4">Action Button</Button>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Test Card 2</CardTitle>
          </CardHeader>
          <CardContent>
            <p>Another test card to verify components work.</p>
            <Button variant="outline" className="mt-4">Secondary Action</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}