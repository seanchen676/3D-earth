'use client';

import React, { useMemo } from 'react';
import * as THREE from 'three';
import { Line } from '@react-three/drei';

interface CountryOutlineProps {
  geometry: {
    type: string;
    coordinates: number[][][] | number[][][][];
  };
  radius: number;
}

export default function CountryOutline({ geometry, radius }: CountryOutlineProps) {
  const lines = useMemo(() => {
    const paths: THREE.Vector3[][] = [];

    // 輔助函式：將經緯度轉換為 3D 座標
    const latLonToVector3 = (lon: number, lat: number, r: number) => {
      const phi = (90 - lat) * (Math.PI / 180);
      const theta = (lon + 180) * (Math.PI / 180);
      const x = -(r * Math.sin(phi) * Math.cos(theta));
      const z = r * Math.sin(phi) * Math.sin(theta);
      const y = r * Math.cos(phi);
      return new THREE.Vector3(x, y, z);
    };

    const processPolygon = (polygon: number[][][]) => {
      polygon.forEach((ring) => {
        const points = ring.map(([lon, lat]) => latLonToVector3(lon, lat, radius * 1.002)); // 稍微浮起一點避免 z-fighting
        paths.push(points);
      });
    };

    if (geometry.type === 'Polygon') {
      processPolygon(geometry.coordinates as number[][][]);
    } else if (geometry.type === 'MultiPolygon') {
      (geometry.coordinates as number[][][][]).forEach((polygon) => processPolygon(polygon));
    }

    return paths;
  }, [geometry, radius]);

  return (
    <group>
      {lines.map((points, index) => (
        <Line
          key={index}
          points={points}
          color="yellow"
          lineWidth={2}
        />
      ))}
    </group>
  );
}
