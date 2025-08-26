'use client'

import { Languages } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useTranslation } from '@/hooks/use-translation'

export default function LanguageSwitcher() {
  const { language, setLanguage } = useTranslation()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon">
          <Languages className="h-[1.2rem] w-[1.2rem]" />
          <span className="sr-only">Toggle language</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setLanguage('en')} disabled={language === 'en'}>
          English
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setLanguage('zh')} disabled={language === 'zh'}>
          中文 (简体)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setLanguage('zh-TW')} disabled={language === 'zh-TW'}>
          中文 (繁體)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setLanguage('ja')} disabled={language === 'ja'}>
          日本語
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setLanguage('ko')} disabled={language === 'ko'}>
          한국어
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

    