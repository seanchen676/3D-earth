'use client'
import dynamic from 'next/dynamic';

const Scene = dynamic(() => import('./components/Scene'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-dvh bg-black flex items-center justify-center">
      <div className="text-white">Loading...</div>
    </div>
  )
});

export default function Home() {
  return (
    <main>
      <Scene />
    </main>
  );
}
