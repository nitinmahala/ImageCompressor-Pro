"use client"

import type React from "react"

import { useState, useRef, useCallback } from "react"
import { Upload, ImageIcon, Download, Moon, Sun, X, ZoomIn, Settings, Github, Loader2 } from "lucide-react"
import { useTheme } from "next-themes"
import imageCompression from "browser-image-compression"
import JSZip from "jszip"
import FileSaver from "file-saver"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Progress } from "@/components/ui/progress"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent } from "@/components/ui/dialog"

interface ImageFile {
  id: string
  file: File
  originalUrl: string
  compressedFile?: File
  compressedUrl?: string
  originalSize: number
  compressedSize?: number
  status: "idle" | "compressing" | "done" | "error"
  progress: number
  error?: string
}

export default function Home() {
  const [images, setImages] = useState<ImageFile[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [isCompressing, setIsCompressing] = useState(false)
  const [quality, setQuality] = useState(80)
  const [aggressiveMode, setAggressiveMode] = useState(false)
  const [maintainRatio, setMaintainRatio] = useState(true)
  const [maxWidth, setMaxWidth] = useState(1920)
  const [maxHeight, setMaxHeight] = useState(1080)
  const [previewImage, setPreviewImage] = useState<{ original: string; compressed: string } | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const { theme, setTheme } = useTheme()

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const validateFile = (file: File): boolean => {
    const validTypes = ["image/jpeg", "image/jpg", "image/png"]
    return validTypes.includes(file.type)
  }

  const processFiles = useCallback((files: FileList | null) => {
    if (!files) return

    const newImages: ImageFile[] = []

    Array.from(files).forEach((file) => {
      if (validateFile(file)) {
        const reader = new FileReader()
        reader.onload = (e) => {
          const result = e.target?.result as string
          newImages.push({
            id: `img-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            file,
            originalUrl: result,
            originalSize: file.size,
            status: "idle",
            progress: 0,
          })

          if (newImages.length === Array.from(files).filter(validateFile).length) {
            setImages((prev) => [...prev, ...newImages])
          }
        }
        reader.readAsDataURL(file)
      }
    })
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(false)

      const { files } = e.dataTransfer
      processFiles(files)
    },
    [processFiles],
  )

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const { files } = e.target
      processFiles(files)
    },
    [processFiles],
  )

  const handleUploadClick = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const compressImage = useCallback(
    async (imageFile: ImageFile) => {
      try {
        setImages((prev) =>
          prev.map((img) => (img.id === imageFile.id ? { ...img, status: "compressing", progress: 0 } : img)),
        )

        const options = {
          maxSizeMB: 1,
          maxWidthOrHeight: Math.max(maxWidth, maxHeight),
          useWebWorker: true,
          maxIteration: aggressiveMode ? 15 : 10,
          initialQuality: quality / 100,
          onProgress: (progress: number) => {
            setImages((prev) => prev.map((img) => (img.id === imageFile.id ? { ...img, progress } : img)))
          },
        }

        const compressedFile = await imageCompression(imageFile.file, options)
        const reader = new FileReader()

        reader.onload = (e) => {
          const result = e.target?.result as string
          setImages((prev) =>
            prev.map((img) =>
              img.id === imageFile.id
                ? {
                    ...img,
                    compressedFile,
                    compressedUrl: result,
                    compressedSize: compressedFile.size,
                    status: "done",
                    progress: 100,
                  }
                : img,
            ),
          )
        }

        reader.readAsDataURL(compressedFile)
      } catch (error) {
        console.error("Compression error:", error)
        setImages((prev) =>
          prev.map((img) =>
            img.id === imageFile.id ? { ...img, status: "error", error: "Failed to compress image" } : img,
          ),
        )
      }
    },
    [quality, aggressiveMode, maxWidth, maxHeight],
  )

  const compressAllImages = useCallback(async () => {
    setIsCompressing(true)

    const pendingImages = images.filter((img) => img.status === "idle")

    for (const img of pendingImages) {
      await compressImage(img)
    }

    setIsCompressing(false)
  }, [images, compressImage])

  const downloadImage = useCallback((imageFile: ImageFile) => {
    if (!imageFile.compressedFile) return

    const link = document.createElement("a")
    link.href = URL.createObjectURL(imageFile.compressedFile)
    link.download = `compressed-${imageFile.file.name}`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }, [])

  const downloadAllImages = useCallback(() => {
    const compressedImages = images.filter((img) => img.status === "done" && img.compressedFile)

    if (compressedImages.length === 0) return

    if (compressedImages.length === 1) {
      downloadImage(compressedImages[0])
      return
    }

    const zip = new JSZip()

    compressedImages.forEach((img) => {
      if (img.compressedFile) {
        zip.file(`compressed-${img.file.name}`, img.compressedFile)
      }
    })

    zip.generateAsync({ type: "blob" }).then((content) => {
      FileSaver.saveAs(content, "compressed-images.zip")
    })
  }, [images, downloadImage])

  const removeImage = useCallback((id: string) => {
    setImages((prev) => prev.filter((img) => img.id !== id))
  }, [])

  const clearAllImages = useCallback(() => {
    setImages([])
  }, [])

  const handleWidthChange = useCallback(
    (value: number) => {
      setMaxWidth(value)
      if (maintainRatio) {
        // Assuming 16:9 ratio
        setMaxHeight(Math.round((value * 9) / 16))
      }
    },
    [maintainRatio],
  )

  const handleHeightChange = useCallback(
    (value: number) => {
      setMaxHeight(value)
      if (maintainRatio) {
        // Assuming 16:9 ratio
        setMaxWidth(Math.round((value * 16) / 9))
      }
    },
    [maintainRatio],
  )

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  }

  const calculateSavings = (original: number, compressed: number): string => {
    const savings = ((original - compressed) / original) * 100
    return `${savings.toFixed(1)}%`
  }

  const openPreview = (original: string, compressed: string) => {
    setPreviewImage({ original, compressed })
  }

  const totalOriginalSize = images.reduce((acc, img) => acc + img.originalSize, 0)
  const totalCompressedSize = images.reduce((acc, img) => acc + (img.compressedSize || 0), 0)
  const hasCompressedImages = images.some((img) => img.status === "done")

  return (
    <main className="min-h-screen flex flex-col">
      <header className="border-b border-white/10 dark:border-white/5 backdrop-blur-md bg-white/5 dark:bg-black/20 sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg neomorphic flex items-center justify-center">
              <ImageIcon className="h-5 w-5 text-primary" />
            </div>
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary-dark">
              ImageCompressor Pro
            </h1>
          </div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                  className="rounded-full neomorphic w-10 h-10"
                >
                  <Sun className="h-5 w-5 rotate-0 scale-100 transition-all text-primary dark:-rotate-90 dark:scale-0" />
                  <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all text-primary dark:rotate-0 dark:scale-100" />
                  <span className="sr-only">Toggle theme</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent className="glass-effect">
                <p>Toggle dark mode</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </header>

      <section className="py-16 relative overflow-hidden">
        <div className="absolute inset-0 dark-gradient opacity-10 dark:opacity-30"></div>
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-primary/20 blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-primary-dark/20 blur-3xl"></div>

        <div className="container mx-auto px-4 text-center relative z-10">
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary-dark">
            Compress PNG and JPG Images Without Losing Quality
          </h1>
          <p className="text-lg md:text-xl text-foreground/80 mb-8 max-w-2xl mx-auto">
            Free. Fast. Secure. No image is uploaded to a server.
          </p>
          <Button
            size="lg"
            className="gap-2 rounded-full teal-gradient text-black hover-scale button-glow"
            onClick={handleUploadClick}
          >
            <Upload className="h-5 w-5" />
            Upload Your Images Now
          </Button>
        </div>
      </section>

      <section className="py-12">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <Card className={`p-6 border-0 neomorphic transition-all ${isDragging ? 'border-primary border-dashed bg-primary/5' : ''}`}>
                <div
                  className="min-h-[300px] flex flex-col items-center justify-center gap-4 rounded-xl"
                  onDragEnter={handleDragEnter}
                  onDragLeave={handleDragLeave}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept=".jpg,.jpeg,.png"
                    multiple
                    onChange={handleFileInputChange}
                  />

                  {images.length === 0 ? (
                    <>
                      <div className="w-20 h-20 rounded-full neomorphic flex items-center justify-center">
                        <Upload className="h-10 w-10 text-primary" />
                      </div>
                      <div className="text-center">
                        <h3 className="text-lg font-medium mb-2">Drag & Drop Your Images Here</h3>
                        <p className="text-foreground/60 mb-4">Or click the button below to select files</p>
                        <Button
                          onClick={handleUploadClick}
                          className="rounded-full teal-gradient text-black hover-scale"
                        >
                          Select Images
                        </Button>
                      </div>
                      <p className="text-sm text-foreground/60">
                        Supported formats: PNG, JPG, JPEG
                      </p>
                    </>
                  ) : (
                    <div className="w-full">
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-medium">Your Images</h3>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={handleUploadClick}>
                            Add More
                          </Button>
                          <Button variant="destructive" size="sm" onClick={clearAllImages}>
                            Clear All
                          </Button>
                        </div>
                      </div>

                      <div className="space-y-4">
                        {images.map((img) => (
                          <div key={img.id} className="border-0 neomorphic rounded-lg p-4 flex flex-col md:flex-row gap-4">
                            <div className="flex-shrink-0 w-full md:w-24 h-24 relative rounded-md overflow-hidden">
                              <img
                                src={img.originalUrl || "/placeholder.svg"}
                                alt="Original"
                                className="w-full h-full object-cover"
                              />
                            </div>

                            <div className="flex-grow">
                              <div className="flex justify-between items-start">
                                <div>
                                  <h4 className="font-medium truncate max-w-[200px]">{img.file.name}</h4>
                                  <p className="text-sm text-muted-foreground">
                                    Original: {formatSize(img.originalSize)}
                                  </p>
                                  {img.compressedSize && (
                                    <div className="flex gap-2 items-center">
                                      <p className="text-sm text-muted-foreground">
                                        Compressed: {formatSize(img.compressedSize)}
                                      </p>
                                      <span className="text-xs px-2 py-0.5 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100 rounded-full">
                                        Saved {calculateSavings(img.originalSize, img.compressedSize)}
                                      </span>
                                    </div>
                                  )}
                                </div>

                                <div className="flex gap-1">
                                  {img.status === "done" && img.compressedUrl && (
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => openPreview(img.originalUrl, img.compressedUrl)}
                                          >
                                            <ZoomIn className="h-4 w-4" />
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          <p>Preview comparison</p>
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  )}

                                  {img.status === "done" && (
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button variant="ghost" size="icon" onClick={() => downloadImage(img)}>
                                            <Download className="h-4 w-4" />
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          <p>Download</p>
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  )}

                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button variant="ghost" size="icon" onClick={() => removeImage(img.id)}>
                                          <X className="h-4 w-4" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>Remove</p>
                                      </TooltipContent>
                                    </TooltipProvider>
                                </div>
                              </div>

                              {img.status === "idle" && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="mt-2 rounded-full border-primary text-primary hover:bg-primary hover:text-black"
                                  onClick={() => compressImage(img)}
                                >
                                  Compress
                                </Button>
                              )}

                              {img.status === "compressing" && (
                                <div className="mt-2">
                                  <Progress value={img.progress} className="h-2" />
                                  <p className="text-xs text-muted-foreground mt-1">
                                    Compressing... {Math.round(img.progress)}%
                                  </p>
                                </div>
                              )}

                              {img.status === "error" && (
                                <div className="mt-2 text-sm text-red-500">{img.error || "An error occurred"}</div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>

                      {images.some((img) => img.status === "idle") && (
                        <div className="mt-4 flex justify-center">
                          <Button onClick={compressAllImages} disabled={isCompressing} className="gap-2">
                            {isCompressing && <Loader2 className="h-4 w-4 animate-spin" />}
                            Compress All Images
                          </Button>
                        </div>
                      )}

                      {hasCompressedImages && (
                        <div className="mt-6 p-4 border rounded-lg bg-muted/50">
                          <div className="flex justify-between items-center mb-2">
                            <h4 className="font-medium">Compression Summary</h4>
                            <Button variant="outline" size="sm" onClick={downloadAllImages} className="gap-2">
                              <Download className="h-4 w-4" />
                              Download All
                            </Button>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-sm text-muted-foreground">Original Size</p>
                              <p className="font-medium">{formatSize(totalOriginalSize)}</p>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">Compressed Size</p>
                              <p className="font-medium">{formatSize(totalCompressedSize)}</p>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">Space Saved</p>
                              <p className="font-medium">{formatSize(totalOriginalSize - totalCompressedSize)}</p>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">Reduction</p>
                              <p className="font-medium">{calculateSavings(totalOriginalSize, totalCompressedSize)}</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </Card>
            </div>

            <div>
              <Card className="p-6 border-0 neomorphic">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-full neomorphic flex items-center justify-center">
                    <Settings className="h-4 w-4 text-primary" />
                  </div>
                  <h3 className="text-lg font-medium">Compression Options</h3>
                </div>

                <div className="space-y-6">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <Label htmlFor="quality">Quality ({quality}%)</Label>
                    </div>
                    <Slider
                      id="quality"
                      min={40}
                      max={95}
                      step={1}
                      value={[quality]}
                      onValueChange={(value) => setQuality(value[0])}
                      className="py-1"
                    />
                    <p className="text-xs text-foreground/60">
                      Higher quality means larger file size
                    </p>
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-sm font-medium">Resize Options</h4>

                    <div className="flex items-center justify-between">
                      <Label htmlFor="maintain-ratio">Maintain Aspect Ratio</Label>
                      <Switch id="maintain-ratio" checked={maintainRatio} onCheckedChange={setMaintainRatio} />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="max-width">Max Width</Label>
                        <Input
                          id="max-width"
                          type="number"
                          value={maxWidth}
                          onChange={(e) => handleWidthChange(Number.parseInt(e.target.value) || 0)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="max-height">Max Height</Label>
                        <Input
                          id="max-height"
                          type="number"
                          value={maxHeight}
                          onChange={(e) => handleHeightChange(Number.parseInt(e.target.value) || 0)}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="aggressive-mode">Aggressive Compression</Label>
                      <p className="text-xs text-muted-foreground">May slightly reduce quality</p>
                    </div>
                    <Switch id="aggressive-mode" checked={aggressiveMode} onCheckedChange={setAggressiveMode} />
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 relative overflow-hidden">
        <div className="absolute inset-0 dark-gradient opacity-5 dark:opacity-20"></div>
        <div className="container mx-auto px-4 relative z-10">
          <h2 className="text-2xl font-bold text-center mb-12 bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary-dark">How It Works</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="glass-card p-8 rounded-2xl hover-scale">
              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-full neomorphic flex items-center justify-center mb-6">
                  <Upload className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-lg font-medium mb-3">Upload</h3>
                <p className="text-foreground/70">
                  Drag or select PNG/JPG files from your device. No file size limits.
                </p>
              </div>
            </div>

            <div className="glass-card p-8 rounded-2xl hover-scale">
              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-full neomorphic flex items-center justify-center mb-6">
                  <Settings className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-lg font-medium mb-3">Compress</h3>
                <p className="text-foreground/70">
                  We reduce file size without reducing image quality using advanced algorithms.
                </p>
              </div>
            </div>

            <div className="glass-card p-8 rounded-2xl hover-scale">
              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-full neomorphic flex items-center justify-center mb-6">
                  <Download className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-lg font-medium mb-3">Download</h3>
                <p className="text-foreground/70">
                  Get your compressed images instantly. Download individually or as a ZIP.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="py-8 border-t border-white/10 dark:border-white/5">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="text-center md:text-left">
              <p className="text-sm text-foreground/60">
                © 2025 Nitin Mahala. All rights reserved.
              </p>
              <div className="flex gap-4 mt-2 text-sm">
                <a href="#" className="text-foreground/60 hover:text-primary transition-colors">Terms of Use</a>
                <a href="#" className="text-foreground/60 hover:text-primary transition-colors">Privacy Policy</a>
              </div>
            </div>

            <a
              href="https://github.com/nitinmahala"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-foreground/60 hover:text-primary transition-colors"
            >
              <Github className="h-4 w-4" />
              GitHub
            </a>
          </div>
        </div>
      </footer>

      <Dialog open={!!previewImage} onOpenChange={(open) => !open && setPreviewImage(null)}>
        <DialogContent className="max-w-4xl glass-card border-0">
          <Tabs defaultValue="side-by-side">
            <TabsList className="grid w-full grid-cols-3 p-1 neomorphic-inset rounded-full">
              <TabsTrigger value="side-by-side" className="rounded-full data-[state=active]:neomorphic data-[state=active]:text-primary">Side by Side</TabsTrigger>
              <TabsTrigger value="original" className="rounded-full data-[state=active]:neomorphic data-[state=active]:text-primary">Original</TabsTrigger>
              <TabsTrigger value="compressed" className="rounded-full data-[state=active]:neomorphic data-[state=active]:text-primary">Compressed</TabsTrigger>
            </TabsList>

            <TabsContent value="side-by-side" className="mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium mb-2">Original</p>
                  {previewImage && (
                    <img
                      src={previewImage.original || "/placeholder.svg"}
                      alt="Original"
                      className="w-full rounded-md"
                    />
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium mb-2">Compressed</p>
                  {previewImage && (
                    <img
                      src={previewImage.compressed || "/placeholder.svg"}
                      alt="Compressed"
                      className="w-full rounded-md"
                    />
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="original" className="mt-4">
              {previewImage && (
                <img src={previewImage.original || "/placeholder.svg"} alt="Original" className="w-full rounded-md" />
              )}
            </TabsContent>

            <TabsContent value="compressed" className="mt-4">
              {previewImage && (
                <img
                  src={previewImage.compressed || "/placeholder.svg"}
                  alt="Compressed"
                  className="w-full rounded-md"
                />
              )}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </main>
  )
}
