"use client"

// 固定分类定义 - 唯一数据源
export const CATEGORIES = [
    { value: '', label: '全部' },
    { value: '助教', label: '助教' },
    { value: '助学', label: '助学' },
    { value: '助研', label: '助研' },
    { value: '助管', label: '助管' },
    { value: '助评', label: '助评' },
    { value: '其他', label: '其他' },
] as const

export type CategoryValue = typeof CATEGORIES[number]['value']

interface CategoryTabsProps {
    active: CategoryValue | string
    onChange: (category: CategoryValue) => void
}

export function CategoryTabs({ active, onChange }: CategoryTabsProps) {
    return (
        <nav className="flex items-center gap-1 flex-wrap">
            {CATEGORIES.map((category, index) => {
                const isActive = active === category.value
                const isAll = category.value === ''
                return (
                    <div key={category.value === '' ? '__all__' : category.value} className={isAll ? 'relative mr-2' : ''}>
                        <button
                            onClick={() => onChange(category.value as CategoryValue)}
                            className={`px-2 py-1 text-xs rounded transition-colors cursor-pointer ${
                                isActive
                                    ? 'bg-[#4658FF] text-white'
                                    : 'bg-transparent text-[#565772] hover:text-[#140E35] hover:bg-[#F7F9FF]'
                            }`}
                        >
                            {category.label}
                        </button>
                        {isAll && (
                            <span className="absolute right-[-8px] top-1/2 -translate-y-1/2 w-px h-4 bg-[#E5EAF4]" />
                        )}
                    </div>
                )
            })}
        </nav>
    )
}
