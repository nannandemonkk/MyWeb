const modules = import.meta.glob("../document/*.md", { query: "?raw", eager: true });
const posts = Object.entries(modules).map(([path, module]) => {
    const content = module.default || module;
    const filename = path.split("/").pop().replace(".md", "");
    const titleMatch = content.match(/^#\s+(.+)$/m);
    const title = titleMatch ? titleMatch[1] : filename;
    const dateMatch = content.match(/^#\s+(\d{4}[-.]\d{1,2}[-.]\d{1,2})/m)
    const date = dateMatch ? dateMatch[1] : filename;
    return {
        slug: filename,
        title,
        date,
        content,
    };
});

posts.sort((a, b) => {
      const aNum = parseInt(a.date.replace(/\D/g, "")) || 0;
      const bNum = parseInt(b.date.replace(/\D/g, "")) || 0;
      return bNum - aNum;
    });
    
export default posts;