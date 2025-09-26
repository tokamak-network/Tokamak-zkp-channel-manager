'use client';

import React from 'react';
import { Layout } from '@/components/Layout';

export default function TestPage() {
  return (
    <Layout>
      <div className="max-w-4xl mx-auto text-center">
        <h1>Test Layout</h1>
        <p>This is a test of the Layout component</p>
      </div>
    </Layout>
  );
}