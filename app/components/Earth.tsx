'use client';

import React, { useRef, useState, useEffect, useMemo } from 'react';
import { useFrame, ThreeEvent } from '@react-three/fiber';
import { OrbitControls, Stars, Html, useTexture } from '@react-three/drei';
import * as THREE from 'three';
import * as d3 from 'd3-geo';
import CountryOutline from './CountryOutline';

interface Feature {
  type: string;
  properties: {
    NAME: string;
    [key: string]: unknown;
  };
  geometry: {
    type: string;
    coordinates: number[][][] | number[][][][];
  };
}

interface GeoJSON {
  type: string;
  features: Feature[];
}

export default function Earth() {
  const earthRef = useRef<THREE.Mesh>(null);
  const moonGroupRef = useRef<THREE.Group>(null);
  
  // 使用 useTexture 載入貼圖並優化設定
  const [colorMap, normalMap, moonMap] = useTexture(
    [
      '/textures/earth_daymap_8k.jpg', // 8K 高解析度地球貼圖 (8192x4096)
      '/textures/earth_bump_8k.jpg',
      '/textures/moon_map.jpg'
    ],
    (textures) => {
      // 為所有貼圖設定高品質過濾以提升清晰度
      textures.forEach((texture) => {
        texture.anisotropy = 16; // 最大各向異性過濾
        texture.minFilter = THREE.LinearMipmapLinearFilter;
        texture.magFilter = THREE.LinearFilter;
      });
    }
  );

  const [hovered, setHover] = useState(false);
  const [dragging, setDragging] = useState(false);
  
  // 國家數據相關狀態
  const [countriesData, setCountriesData] = useState<GeoJSON | null>(null);
  const [hoveredCountry, setHoveredCountry] = useState<Feature | null>(null);
  const [tooltipPos, setTooltipPos] = useState<[number, number, number]>([0, 0, 0]);

  // 載入 GeoJSON 數據
  useEffect(() => {
    fetch('/data/countries.geojson')
      .then(res => res.json())
      .then(data => setCountriesData(data));
  }, []);

  // 建立地理查找器
  const geoLookup = useMemo(() => {
    if (!countriesData) return null;
    // 使用 d3.geoContains 進行查找
    return (lat: number, lon: number) => {
      return countriesData.features.find((feature) => 
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        d3.geoContains(feature as any, [lon, lat])
      );
    };
  }, [countriesData]);

  // 處理滑鼠移動事件（桌面）
  const handlePointerMove = (e: ThreeEvent<PointerEvent>) => {
    if (dragging || !geoLookup) return;
    
    // 取得交點的 UV 座標
    const uv = e.uv;
    if (!uv) return;

    // 將 UV 轉換為經緯度
    // UV (0,0) is bottom-left, (1,1) is top-right
    // Texture mapping: 
    // u: 0 -> 1 maps to longitude -180 -> 180
    // v: 0 -> 1 maps to latitude -90 -> 90
    const lon = (uv.x - 0.5) * 360;
    const lat = (uv.y - 0.5) * 180;

    // 查找國家
    const country = geoLookup(lat, lon);
    
    if (country) {
      if (hoveredCountry?.properties?.NAME !== country.properties.NAME) {
        setHoveredCountry(country);
      }
      // 更新 Tooltip 位置 (使用交點座標)
      setTooltipPos([e.point.x, e.point.y, e.point.z]);
    } else {
      setHoveredCountry(null);
    }
  };

  // 處理點擊事件（手機）
  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    if (!geoLookup) return;
    
    const uv = e.uv;
    if (!uv) return;

    const lon = (uv.x - 0.5) * 360;
    const lat = (uv.y - 0.5) * 180;
    const country = geoLookup(lat, lon);
    
    if (country) {
      setHoveredCountry(country);
      setTooltipPos([e.point.x, e.point.y, e.point.z]);
    } else {
      setHoveredCountry(null);
    }
  };

  useFrame(() => {
    if (moonGroupRef.current && !hovered && !dragging) {
      // 月球公轉 (Tidal Locking: 月球本身不自轉，靠 Group 旋轉保持同一面朝向地球)
      // 實際月球公轉週期約 27.3 天，這裡為了視覺效果設為適當速度
      moonGroupRef.current.rotation.y += 0.002;
    }
  });

  return (
    <>
      {/* 星空背景 - 使用固定種子避免 hydration 問題 */}
      <Stars 
        radius={300} 
        depth={60} 
        count={5000} 
        factor={7} 
        saturation={0} 
        fade 
        speed={1}
      />
      
      {/* 環境光與方向光 */}
      <ambientLight intensity={2.5} />
      <directionalLight position={[2, 0, 5]} intensity={5} />

      {/* 地球模型 (半徑 2.5) */}
      <mesh 
        ref={earthRef}
        onPointerOver={() => setHover(true)}
        onPointerOut={() => {
          setHover(false);
          setHoveredCountry(null);
        }}
        onPointerMove={handlePointerMove}
        onClick={handleClick}
      >
        <sphereGeometry args={[2.5, 128, 128]} />
        <meshStandardMaterial 
          map={colorMap} 
          normalMap={normalMap}
          normalScale={new THREE.Vector2(0.5, 0.5)} // 調整凹凸強度
        />
      </mesh>

      {/* 國家輪廓與名稱顯示 */}
      {hoveredCountry && (
        <>
          <CountryOutline geometry={hoveredCountry.geometry} radius={2.5} />
          <Html position={tooltipPos} style={{ pointerEvents: 'none' }}>
            <div className="bg-black/80 text-white px-2 py-1 rounded text-sm whitespace-nowrap border border-white/20 backdrop-blur-sm transform -translate-x-1/2 -translate-y-full -mt-2.5">
              {hoveredCountry.properties.NAME}
            </div>
          </Html>
        </>
      )}

      {/* 月球系統 */}
      {/* 
         物理特性模擬：
         1. 大小比例：月球半徑約為地球的 0.273 倍 (2.5 * 0.273 ≈ 0.68)
         2. 軌道傾角：約 5.14 度 (0.09 弧度)
         3. 潮汐鎖定：月球始終以同一面朝向地球 (透過 Group 旋轉且 Mesh 不自轉達成)
         4. 距離：實際距離約為地球半徑的 60 倍，但為了視覺呈現，這裡縮小為約 6 倍 (15單位)
      */}
      <group ref={moonGroupRef} rotation={[0.09, 0, 0]}> {/* 軌道傾角 */}
        <mesh position={[15, 0, 0]} rotation={[0, -Math.PI / 2, 0]}> {/* 修正貼圖朝向，使正面朝向地球 */}
          <sphereGeometry args={[0.68, 64, 64]} />
          <meshStandardMaterial map={moonMap} />
        </mesh>
      </group>

      {/* 軌道控制器：允許縮放和旋轉，禁止平移以保持地球在中心 */}
      <OrbitControls 
        enableZoom={true} 
        enablePan={false} // 禁止平移，保持地球始終在中心
        enableRotate={true} 
        zoomSpeed={0.6} 
        rotateSpeed={0.4} 
        autoRotate={!hovered && !dragging}
        autoRotateSpeed={0.3} // 調整自轉速度
        onStart={() => setDragging(true)}
        onEnd={() => setDragging(false)}
      />
    </>
  );
}
