import { useSessionSocket } from '../../hooks/useSessionSocket';
import { DialCircular } from '../../components/shared';
import './ModoOperador.css';

interface ModoOperadorProps {
  sessionId: string;
  ministryId: string;
  onTriggerOverride?: (blockId: string) => void;
  onEndSession?: () => void;
}

export function ModoOperador({ sessionId, ministryId, onTriggerOverride, onEndSession }: ModoOperadorProps) {
  const { currentBlock, blocks, isOverrideActive, isConnected } = useSessionSocket(sessionId, ministryId);

  const currentIndex = blocks.findIndex((b) => b.id === currentBlock?.id);
  const progress = blocks.length > 0
    ? Math.min(((currentIndex + 1) / blocks.length) * 100, 100)
    : 0;

  return (
    <div className="modo-operador">
      <header className="modo-operador__header">
        <div className="modo-operador__song-info">
          <h1 className="modo-operador__song-name">{currentBlock?.label || 'Sessao'}</h1>
          <span className="modo-operador__meta">{currentBlock?.duration || 0}s</span>
        </div>
        <span className={`modo-operador__badge ${isOverrideActive ? 'modo-operador__badge--override' : ''}`}>
          {isOverrideActive ? 'Override ativo' : 'Programado'}
        </span>
        <span className={`modo-operador__status ${isConnected ? 'modo-operador__status--connected' : ''}`}>
          {isConnected ? '●' : '○'}
        </span>
      </header>

      <section className="modo-operador__dial">
        <DialCircular value={progress} label={currentBlock?.label || ''} />
        <div className="modo-operador__block-label">{currentBlock?.label || 'Nenhum bloco'}</div>
      </section>

      <section className="modo-operador__timeline">
        {blocks.map((block, i) => (
          <span
            key={block.id}
            className={`modo-operador__pill ${block.id === currentBlock?.id ? 'modo-operador__pill--active' : ''}`}
          >
            {i + 1}
          </span>
        ))}
      </section>

      <section className="modo-operador__grid">
        {blocks.map((block) => (
          <button
            key={block.id}
            className={`modo-operador__grid-item ${block.id === currentBlock?.id ? 'modo-operador__grid-item--active' : ''}`}
            onClick={() => onTriggerOverride?.(block.id)}
          >
            <span className="modo-operador__grid-label">{block.label}</span>
            <span className="modo-operador__grid-duration">{block.duration || 0}s</span>
          </button>
        ))}
      </section>

      <nav className="modo-operador__bottom-nav">
        <button className="modo-operador__nav-pill">Ordem do Culto</button>
        <button className="modo-operador__nav-pill modo-operador__nav-pill--active">Modo Operador</button>
        <button className="modo-operador__nav-pill">Chat</button>
        <button className="modo-operador__nav-pill modo-operador__nav-pill--danger" onClick={onEndSession}>
          Encerrar sessao
        </button>
      </nav>
    </div>
  );
}