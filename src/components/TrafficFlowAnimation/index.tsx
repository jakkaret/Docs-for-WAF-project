import React, {useEffect, useRef, useState} from 'react';
import styles from './styles.module.css';

type Direction = 'request' | 'response';

interface Step {
  nodeIndex: number;
  direction: Direction;
  description: string;
}

const nodes = [
  {label: 'Client', icon: '💻'},
  {label: 'WAF', icon: '🛡️'},
  {label: 'Origin', icon: '🖥️'},
];

const steps: Step[] = [
  {nodeIndex: 0, direction: 'request', description: 'Client ส่ง request ออกไป'},
  {nodeIndex: 1, direction: 'request', description: 'WAF รับ request เข้ามาตรวจสอบก่อน (rule / rate-limit / bot check)'},
  {nodeIndex: 2, direction: 'request', description: 'WAF ตัดสินใจว่า "ผ่าน" แล้ว forward ต่อไปยัง Origin'},
  {nodeIndex: 1, direction: 'response', description: 'Origin ประมวลผลเสร็จ ส่ง response กลับผ่าน WAF'},
  {nodeIndex: 0, direction: 'response', description: 'WAF ส่ง response กลับถึง Client'},
];

export default function TrafficFlowAnimation(): React.ReactElement {
  const [stepIndex, setStepIndex] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const play = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setStepIndex(0);
    let i = 0;
    const advance = () => {
      i += 1;
      if (i < steps.length) {
        setStepIndex(i);
        timerRef.current = setTimeout(advance, 1100);
      }
    };
    timerRef.current = setTimeout(advance, 1100);
  };

  const reset = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setStepIndex(null);
  };

  const current = stepIndex === null ? null : steps[stepIndex];
  const packetLeft =
    current === null ? undefined : `${(current.nodeIndex / (nodes.length - 1)) * 100}%`;

  return (
    <div className={styles.wrapper}>
      <div className={styles.controls}>
        <button className={styles.button} onClick={play}>
          ▶ เล่น Animation
        </button>
        <button className={styles.button} onClick={reset}>
          ↺ Reset
        </button>
        <span className={styles.stepLabel}>{current?.description ?? 'กดปุ่ม "เล่น Animation" เพื่อดูลำดับการทำงาน'}</span>
      </div>

      <div className={styles.track}>
        <div className={styles.line} />
        {packetLeft !== undefined && (
          <div className={styles.packet} style={{left: packetLeft}} />
        )}
        {nodes.map((node, index) => (
          <div
            key={node.label}
            className={`${styles.node} ${current?.nodeIndex === index ? styles.nodeActive : ''}`}
          >
            <div className={styles.nodeCircle}>{node.icon}</div>
            <div className={styles.nodeLabel}>{node.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
