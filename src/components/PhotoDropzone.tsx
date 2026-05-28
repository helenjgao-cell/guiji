import { useState, useRef } from 'react'

interface Props {
  onPhotos: (files: File[]) => Promise<void>
  processing: boolean
}

export default function PhotoDropzone({ onPhotos, processing }: Props) {
  const [active, setActive] = useState(false)
  const galleryInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  async function handleFiles(fileList: FileList | null, sourceRef: React.RefObject<HTMLInputElement>) {
    if (!fileList || processing) return
    const files = Array.from(fileList).filter((f) => f.type.startsWith('image/'))
    if (files.length === 0) return
    await onPhotos(files)
    if (sourceRef.current) sourceRef.current.value = ''
  }

  return (
    <div className="dropzone-area">
      <div
        className={`dropzone ${active ? 'active' : ''} ${processing ? 'processing' : ''}`}
        onClick={(e) => {
          // 避免子按钮触发整体 dropzone
          if (e.target !== e.currentTarget && !(e.target as HTMLElement).closest('.dropzone-main, .dropzone-hint')) return
          if (!processing) galleryInputRef.current?.click()
        }}
        onDragOver={(e) => {
          e.preventDefault()
          if (!processing) setActive(true)
        }}
        onDragLeave={() => setActive(false)}
        onDrop={(e) => {
          e.preventDefault()
          setActive(false)
          if (!processing) handleFiles(e.dataTransfer.files, galleryInputRef)
        }}
      >
        <input
          ref={galleryInputRef}
          type="file"
          accept="image/*"
          multiple
          style={{ display: 'none' }}
          onChange={(e) => handleFiles(e.target.files, galleryInputRef)}
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          style={{ display: 'none' }}
          onChange={(e) => handleFiles(e.target.files, cameraInputRef)}
        />
        <div className="dropzone-main">
          {processing ? '识别中...' : '把旅行照片拖进来，或点击选择'}
        </div>
        <div className="dropzone-hint">
          会读照片的 GPS 信息识别城市，没 GPS 的照片会被跳过
        </div>
      </div>
      <button
        type="button"
        className="camera-btn"
        onClick={() => !processing && cameraInputRef.current?.click()}
        disabled={processing}
      >
        📷 用相机拍一张
      </button>
    </div>
  )
}
