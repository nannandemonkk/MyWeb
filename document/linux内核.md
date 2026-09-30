《linux内核设计的艺术》 
第一章
BIOS 引导 加载bootsect 到 0x07c0
bootsect.s 自搬到0x90000 读setup 到 0x90200 读system 到0x10000 (关闭软驱马达 定根设备) 跳setup
setup.s 采集硬件参数到 0x90000 cli system搬 0 启动临时gdt 废除idt 开启A20 8259A搬到 0x20-0x2F 置PE进入保护模式 跳到head.s
head.s 段寄存器=0x10 换内核栈 建立中断门 建立GDT 自检A20 建页目录 建页表 CR3=0、CR0.PG=1 → ret 进 main

1：bootsect 把自己搬到 0x90000 之后（还没读 setup）
    0x00000-0x7FFFF   空
    0x7C00            BIOS 读进来的引导扇区副本（已被抛弃，内容还在但没人管）
    0x90000-0x901FF   bootsect.s 自己（512 字节）
    0x9FF00           栈顶（SS=0x9000, SP=0xFF00，往下长）

快照 2：bootsect 读完 setup 和 system，准备跳转

    0x10000-0x3FFFF   system 模块（head.s + main.c + 内核，最多 192KB）
    0x90000-0x901FF   bootsect.s
    0x90200-0x909FF   setup.s（4 扇区 = 2KB）
    0x9FF00           栈

快照 3：setup.s 搬完 system，准备进保护模式

    0x00000-0x7FFFF   system 模块被搬下来（源 0x10000-0x8FFF共 512KB）
    0x90000-0x901FF   硬件参数（setup 用 BIOS 中断采集的，盖在 bootsect 老位置上）
    0x90200-0x909FF   setup.s 自己在跑
    0x90314           setup 建的临时 GDT（24 字节，3 项）
    0x9FF00           栈（还在用 bootsect 留下的那个）

快照 4：head.s 开分页之后

    0x00000-0x00FFF   页目录（4KB）—— 覆盖掉 head.s 开头那段代码
    0x01000-0x04FFF   页表 pg0-pg3（各 4KB，恒等映射 0-16MB）
    0x05000-0x053FF   tmp_floppy_area（软驱 DMA 缓冲区）
    0x05400 起        head.s 剩下的代码 + 新 GDT/IDT + main 及各内核函数
    0x90000-0x901FF   硬件参数（内核启动后 con_init、硬盘驱动会来取）
    0x90200-0x909FF   setup.s（已无用，等着被缓冲区覆盖）