import { Crop, Move, RotateCcw, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { GALLERY_IMAGE_SIZE } from '../lib/api'
import styles from '../pages/Platform.module.css'

type Point = { x: number; y: number }
type Size = { width: number; height: number }

const clamp = (value: number, minimum: number, maximum: number) => Math.min(maximum, Math.max(minimum, value))

export function SquareImageCropper({ file, onCancel, onConfirm }: {
  file: File
  onCancel: () => void
  onConfirm: (file: File) => void
}) {
  const stageRef = useRef<HTMLDivElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const dragRef = useRef<{ pointerId: number; start: Point; offset: Point } | null>(null)
  const [stageSize, setStageSize] = useState(0)
  const [imageSize, setImageSize] = useState<Size>({ width: 0, height: 0 })
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState<Point>({ x: 0, y: 0 })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const sourceUrl = useMemo(() => URL.createObjectURL(file), [file])

  useEffect(() => () => URL.revokeObjectURL(sourceUrl), [sourceUrl])
  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    const observer = new ResizeObserver(([entry]) => setStageSize(entry.contentRect.width))
    observer.observe(stage)
    return () => observer.disconnect()
  }, [])

  const baseScale = stageSize && imageSize.width
    ? Math.max(stageSize / imageSize.width, stageSize / imageSize.height)
    : 1
  const renderedWidth = imageSize.width * baseScale * zoom
  const renderedHeight = imageSize.height * baseScale * zoom
  const maxOffset = {
    x: Math.max(0, (renderedWidth - stageSize) / 2),
    y: Math.max(0, (renderedHeight - stageSize) / 2),
  }

  useEffect(() => {
    setOffset((current) => ({
      x: clamp(current.x, -maxOffset.x, maxOffset.x),
      y: clamp(current.y, -maxOffset.y, maxOffset.y),
    }))
  }, [maxOffset.x, maxOffset.y])

  function moveImage(point: Point) {
    setOffset({
      x: clamp(point.x, -maxOffset.x, maxOffset.x),
      y: clamp(point.y, -maxOffset.y, maxOffset.y),
    })
  }

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = { pointerId: event.pointerId, start: { x: event.clientX, y: event.clientY }, offset }
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    moveImage({ x: drag.offset.x + event.clientX - drag.start.x, y: drag.offset.y + event.clientY - drag.start.y })
  }

  function stopDragging(event: React.PointerEvent<HTMLDivElement>) {
    if (dragRef.current?.pointerId !== event.pointerId) return
    dragRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const movement: Record<string, Point> = {
      ArrowLeft: { x: -8, y: 0 }, ArrowRight: { x: 8, y: 0 },
      ArrowUp: { x: 0, y: -8 }, ArrowDown: { x: 0, y: 8 },
    }
    const change = movement[event.key]
    if (!change) return
    event.preventDefault()
    moveImage({ x: offset.x + change.x, y: offset.y + change.y })
  }

  async function applyCrop() {
    const image = imageRef.current
    if (!image || !stageSize || !imageSize.width) return
    setSaving(true); setError('')
    try {
      const effectiveScale = baseScale * zoom
      const sourceSize = stageSize / effectiveScale
      const imageLeft = (stageSize - renderedWidth) / 2 + offset.x
      const imageTop = (stageSize - renderedHeight) / 2 + offset.y
      const sourceX = clamp(-imageLeft / effectiveScale, 0, imageSize.width - sourceSize)
      const sourceY = clamp(-imageTop / effectiveScale, 0, imageSize.height - sourceSize)
      const canvas = document.createElement('canvas')
      canvas.width = GALLERY_IMAGE_SIZE
      canvas.height = GALLERY_IMAGE_SIZE
      const context = canvas.getContext('2d')
      if (!context) throw new Error('This browser could not crop the image.')
      context.imageSmoothingEnabled = true
      context.imageSmoothingQuality = 'high'
      context.drawImage(image, sourceX, sourceY, sourceSize, sourceSize, 0, 0, GALLERY_IMAGE_SIZE, GALLERY_IMAGE_SIZE)
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', .9))
      if (!blob) throw new Error('This browser could not prepare the cropped image.')
      const name = file.name.replace(/\.[^.]+$/, '') || 'gallery-image'
      onConfirm(new File([blob], `${name}-1200.webp`, { type: 'image/webp' }))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'This image could not be cropped.')
    } finally { setSaving(false) }
  }

  return (
    <div className={styles.cropperBackdrop} role="dialog" aria-modal="true" aria-labelledby="gallery-crop-title">
      <section className={styles.cropperModal}>
        <button className={styles.cropperClose} type="button" onClick={onCancel} aria-label="Close image cropper"><X /></button>
        <div className={styles.cropperHeader}><span><Crop /> Image crop</span><h2 id="gallery-crop-title">Frame the food photo</h2><p>Drag the photo and zoom until the complete dish sits comfortably inside the square.</p></div>
        <div
          ref={stageRef}
          className={styles.cropperStage}
          tabIndex={0}
          aria-label="Crop area. Drag the image or use the arrow keys to reposition it."
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={stopDragging}
          onPointerCancel={stopDragging}
          onKeyDown={handleKeyDown}
        >
          <img
            ref={imageRef}
            src={sourceUrl}
            alt=""
            draggable="false"
            onLoad={(event) => setImageSize({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })}
            style={{
              width: renderedWidth || undefined,
              height: renderedHeight || undefined,
              left: stageSize ? (stageSize - renderedWidth) / 2 + offset.x : '50%',
              top: stageSize ? (stageSize - renderedHeight) / 2 + offset.y : '50%',
            }}
          />
          <span className={styles.cropperGrid} aria-hidden="true" />
          <span className={styles.cropperMoveHint}><Move /> Drag to reposition</span>
        </div>
        <div className={styles.cropperControls}>
          <label>Zoom<input type="range" min="1" max="3" step="0.01" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} /></label>
          <button type="button" onClick={() => { setZoom(1); setOffset({ x: 0, y: 0 }) }}><RotateCcw /> Reset</button>
          <span>{imageSize.width} × {imageSize.height} source → {GALLERY_IMAGE_SIZE} × {GALLERY_IMAGE_SIZE} output</span>
        </div>
        {error && <p className={styles.cropperError} role="alert">{error}</p>}
        <div className={styles.cropperActions}><button type="button" onClick={onCancel}>Cancel</button><button type="button" className="button button-primary" disabled={saving || !imageSize.width} onClick={() => void applyCrop()}>{saving ? 'Preparing…' : `Use ${GALLERY_IMAGE_SIZE} × ${GALLERY_IMAGE_SIZE} image`}</button></div>
      </section>
    </div>
  )
}
