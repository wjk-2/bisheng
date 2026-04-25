"use client"

import { ArrowLeft, Home } from "lucide-react"

export default function Page404() {
    return (
        <div className="min-h-screen flex items-center justify-center px-4 bg-background">
            <div className="max-w-2xl w-full text-center space-y-8">
                <div className="space-y-4">
                    <h1 className="text-[clamp(6rem,20vw,12rem)] font-bold leading-none tracking-tighter text-foreground/10">
                        404
                    </h1>
                    <div className="-mt-12 space-y-3">
                        <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">页面不存在</h2>
                        <p className="text-base md:text-lg text-muted-foreground max-w-md mx-auto leading-relaxed">
                            您访问的页面不存在或已被移除
                        </p>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
                    <a
                        href="/workspace/"
                        className="inline-flex items-center gap-2 px-6 py-2.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
                    >
                        <Home className="h-4 w-4" />
                        返回首页
                    </a>
                    <button
                        type="button"
                        onClick={() => window.history.back()}
                        className="inline-flex items-center gap-2 px-6 py-2.5 rounded-md border border-input bg-transparent text-sm font-medium hover:bg-accent transition-colors"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        返回上一页
                    </button>
                </div>
            </div>
        </div>
    )
}
