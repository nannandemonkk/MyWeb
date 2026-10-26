// src/hooks/usePosts.js —— 数据层：管理"文章列表"这份数据的完整生命周期
// use 开头 = 自定义 Hook，组件里可以像 useState 一样调用它
// 它把"怎么拿数据"全部封装掉，组件只拿到三样现成的结果

import { useEffect, useState } from "react";
import { fetchPosts } from "../api";

export function usePosts() {
  // 三样东西：数据、还在不在加载、有没有出错
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // 组件第一次显示出来的时候，去后端要数据
  useEffect(() => {
    fetchPosts()
      .then(setPosts)                          // 成功：把数据存进状态
      .catch((err) => setError(err.message))   // 失败：记住错误信息
      .finally(() => setLoading(false));       // 不管成败：不再加载了
  }, []);                                      // [] = 只在第一次执行一次

  // 把结果打包交出去，调用方拿到就能直接用
  return { posts, loading, error };
}
