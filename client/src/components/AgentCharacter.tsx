import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import type { Agent } from "@shared/schema";

interface AgentCharacterProps {
  agent: Agent;
  position: [number, number, number];
  selected: boolean;
  onClick: () => void;
}

function Body({ color, isWorking }: { color: string; isWorking: boolean }) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.elapsedTime;
    groupRef.current.position.y = Math.sin(t * 2) * 0.02;
    if (isWorking) {
      groupRef.current.rotation.z = Math.sin(t * 8) * 0.03;
    }
  });

  return (
    <group ref={groupRef}>
      <mesh position={[0, 0.45, 0]}>
        <sphereGeometry args={[0.35, 32, 32]} />
        <meshStandardMaterial color={color} />
      </mesh>

      <mesh position={[-0.22, 0.75, 0.1]}>
        <sphereGeometry args={[0.1, 16, 16]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={[0.22, 0.75, 0.1]}>
        <sphereGeometry args={[0.1, 16, 16]} />
        <meshStandardMaterial color={color} />
      </mesh>

      <mesh position={[-0.1, 0.48, 0.28]}>
        <sphereGeometry args={[0.05, 16, 16]} />
        <meshStandardMaterial color="#1a1a2e" />
      </mesh>
      <mesh position={[0.1, 0.48, 0.28]}>
        <sphereGeometry args={[0.05, 16, 16]} />
        <meshStandardMaterial color="#1a1a2e" />
      </mesh>

      <mesh position={[0, 0.38, 0.3]}>
        <sphereGeometry args={[0.04, 16, 16]} />
        <meshStandardMaterial color="#ff9999" />
      </mesh>

      <mesh position={[0, -0.1, 0]}>
        <capsuleGeometry args={[0.25, 0.3, 16, 16]} />
        <meshStandardMaterial color={color} />
      </mesh>

      <mesh position={[-0.35, 0, 0]} rotation={[0, 0, 0.3]}>
        <capsuleGeometry args={[0.08, 0.2, 8, 8]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={[0.35, 0, 0]} rotation={[0, 0, -0.3]}>
        <capsuleGeometry args={[0.08, 0.2, 8, 8]} />
        <meshStandardMaterial color={color} />
      </mesh>
    </group>
  );
}

function Laptop({ isWorking }: { isWorking: boolean }) {
  const screenRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (!screenRef.current) return;
    const mat = screenRef.current.material as THREE.MeshStandardMaterial;
    if (isWorking) {
      mat.emissiveIntensity = 0.5 + Math.sin(state.clock.elapsedTime * 4) * 0.3;
    } else {
      mat.emissiveIntensity = 0.2;
    }
  });

  return (
    <group position={[0, -0.25, 0.4]}>
      <mesh rotation={[-0.2, 0, 0]}>
        <boxGeometry args={[0.4, 0.02, 0.3]} />
        <meshStandardMaterial color="#333" />
      </mesh>
      <mesh ref={screenRef} position={[0, 0.18, -0.12]} rotation={[0.8, 0, 0]}>
        <boxGeometry args={[0.38, 0.25, 0.01]} />
        <meshStandardMaterial color="#1a1a2e" emissive={isWorking ? "#5865F2" : "#333"} emissiveIntensity={0.2} />
      </mesh>
    </group>
  );
}

function StatusCard({ agent, selected }: { agent: Agent; selected: boolean }) {
  const roleLabels: Record<string, string> = {
    frontend: "프론트엔드",
    backend: "백엔드",
    testing: "테스팅",
    general: "일반",
  };

  const statusLabels: Record<string, string> = {
    idle: "대기 중",
    working: "작업 중",
    paused: "일시정지",
  };

  return (
    <Html position={[0, 1.2, 0]} center distanceFactor={5}>
      <div
        data-testid={`status-card-agent-${agent.id}`}
        style={{
          background: selected ? "rgba(88, 101, 242, 0.95)" : "rgba(64, 68, 75, 0.95)",
          borderRadius: "12px",
          padding: "8px 14px",
          color: "white",
          fontFamily: "'Space Grotesk', 'Inter', sans-serif",
          fontSize: "11px",
          textAlign: "center",
          minWidth: "100px",
          backdropFilter: "blur(10px)",
          border: selected ? "2px solid #5865F2" : "1px solid rgba(255,255,255,0.1)",
          boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
          pointerEvents: "none",
          whiteSpace: "nowrap",
        }}
      >
        <div style={{ fontWeight: 700, fontSize: "13px", marginBottom: "2px" }}>{agent.name}</div>
        <div style={{ color: "#57F287", fontSize: "10px" }}>{roleLabels[agent.role] || agent.role}</div>
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "4px",
          marginTop: "4px",
          fontSize: "10px",
          color: agent.status === "working" ? "#FEE75C" : "#aaa",
        }}>
          <span style={{
            width: "6px",
            height: "6px",
            borderRadius: "50%",
            backgroundColor: agent.status === "working" ? "#FEE75C" : agent.status === "idle" ? "#57F287" : "#aaa",
            display: "inline-block",
            animation: agent.status === "working" ? "pulse 1s infinite" : "none",
          }} />
          {statusLabels[agent.status] || agent.status}
        </div>
        {agent.currentFile && (
          <div style={{ fontSize: "9px", color: "#aaa", marginTop: "3px", maxWidth: "120px", overflow: "hidden", textOverflow: "ellipsis" }}>
            📄 {agent.currentFile}
          </div>
        )}
      </div>
    </Html>
  );
}

export default function AgentCharacter({ agent, position, selected, onClick }: AgentCharacterProps) {
  const isWorking = agent.status === "working";

  return (
    <group position={position} onClick={(e) => { e.stopPropagation(); onClick(); }} style={{ cursor: "pointer" }}>
      <StatusCard agent={agent} selected={selected} />
      <Body color={agent.color} isWorking={isWorking} />
      <Laptop isWorking={isWorking} />

      {selected && (
        <mesh position={[0, -0.5, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.5, 0.6, 32]} />
          <meshBasicMaterial color="#5865F2" transparent opacity={0.5} />
        </mesh>
      )}
    </group>
  );
}
