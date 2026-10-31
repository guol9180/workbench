/**
 * 共享 Combobox：可输入 + 可下拉选择。
 * - 键盘：↑↓ 移动、Enter 选中、Esc 关闭；鼠标点击选项不抢输入焦点
 * - 过滤：首次聚焦展示全部，开始输入才按关键字过滤；空结果给出可行动提示
 * - 视觉：下拉面板走语义令牌与 --shadow-pop，禁止浏览器原生 datalist 观感
 */
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { Icon } from './Icon'

export interface ComboboxProps {
  value: string
  onChange: (value: string) => void
  options: string[]
  placeholder?: string
  ariaLabel: string
  emptyText?: string
  disabled?: boolean
  className?: string
}

export function Combobox({
  value,
  onChange,
  options,
  placeholder,
  ariaLabel,
  emptyText = '没有匹配项',
  disabled = false,
  className = '',
}: ComboboxProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isFiltering, setIsFiltering] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listboxId = useId()

  const filteredOptions = useMemo(() => {
    if (!isFiltering) return options
    const keyword = value.trim().toLowerCase()
    if (!keyword) return options
    return options.filter((option) => option.toLowerCase().includes(keyword))
  }, [options, isFiltering, value])

  // 点外部关闭；选项自身用 mousedown preventDefault 保住输入焦点
  useEffect(() => {
    if (!isOpen) return
    const handlePointerDown = (event: MouseEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) setIsOpen(false)
    }
    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [isOpen])

  useEffect(() => {
    setActiveIndex(0)
  }, [value, isOpen])

  function selectOption(option: string) {
    onChange(option)
    setIsFiltering(false)
    setIsOpen(false)
    inputRef.current?.focus()
  }

  function openList() {
    if (disabled) return
    setIsOpen(true)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      openList()
      setActiveIndex((currentIndex) => Math.min(filteredOptions.length - 1, currentIndex + 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      openList()
      setActiveIndex((currentIndex) => Math.max(0, currentIndex - 1))
    } else if (event.key === 'Enter') {
      if (isOpen && filteredOptions[activeIndex]) {
        event.preventDefault()
        selectOption(filteredOptions[activeIndex])
      }
    } else if (event.key === 'Escape') {
      setIsOpen(false)
    }
  }

  const activeOptionId = isOpen ? `${listboxId}-option-${activeIndex}` : undefined

  return (
    <div ref={wrapperRef} className={'combo ' + className}>
      <input
        ref={inputRef}
        className="input combo-input"
        value={value}
        role="combobox"
        aria-label={ariaLabel}
        aria-expanded={isOpen}
        aria-controls={isOpen ? listboxId : undefined}
        aria-autocomplete="list"
        aria-activedescendant={activeOptionId}
        autoComplete="off"
        spellCheck={false}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(event) => {
          onChange(event.target.value)
          setIsFiltering(true)
          openList()
        }}
        onFocus={() => {
          setIsFiltering(false)
          openList()
        }}
        onClick={openList}
        onKeyDown={handleKeyDown}
      />
      <Icon
        name="chevron-down"
        size={14}
        className={'combo-caret' + (isOpen ? ' open' : '')}
      />
      {isOpen && (
        <div className="combo-pop" id={listboxId} role="listbox" aria-label={ariaLabel}>
          {filteredOptions.length === 0 ? (
            <div className="combo-empty">{emptyText}</div>
          ) : (
            filteredOptions.map((option, optionIndex) => (
              <button
                key={option}
                id={`${listboxId}-option-${optionIndex}`}
                type="button"
                role="option"
                aria-selected={optionIndex === activeIndex}
                className={'combo-option' + (optionIndex === activeIndex ? ' active' : '')}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActiveIndex(optionIndex)}
                onClick={() => selectOption(option)}
              >
                <span className="combo-option-label">{option}</span>
                {option === value && <Icon name="check" size={13} />}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
