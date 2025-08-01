"use client"
import Footer from '@/app/components/site/footer'
import NavBar from '@/app/components/site/navbar'
import '../../App.css';
import "../../globals.scss";
import { useEffect, useState } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useLocale } from 'next-intl';
import BlogBreadcrumb from './breadcrumb';

interface BlogPageProps {
    params: Promise<{
        blogId: string;
    }>;
}

export default function BlogPage({ params }: BlogPageProps) {
    const locale = useLocale();
    const [blogId, setBlogId] = useState<string | null>(null);
    const [markdown, setMarkdown] = useState<string>("");

    useEffect(() => {
        (async () => {
            const awaitedParams = await params;
            setBlogId(awaitedParams.blogId);
            const fetchMarkdown = async () => {
                try {
                    const res = await fetch(`/blog/${locale}/blog${awaitedParams.blogId}.md`);
                    if (res.ok) {
                        const text = await res.text();
                        setMarkdown(text);
                    } else {
                        throw new Error(res.statusText);
                    }
                } catch (error) {
                    console.error('Failed to fetch markdown:', error);
                }
            };
            fetchMarkdown();
        })();
    }, [params, locale]);


    if (!blogId) return (
        <div className="App" style={{ backgroundColor: 'var(--bulma-scheme-main)' }}>
            <NavBar />
            <section className="section" style={{ backgroundColor: 'var(--bulma-scheme-main)', minHeight: '100vh' }}>
                <div className="container has-text-left">
                    <BlogBreadcrumb />

                    <div className="content has-text-left" style={{ opacity: 0.2 }}>
                        <div className="skeleton-block"></div>
                        <div className="skeleton-lines">
                            <div></div>
                            <div></div>
                            <div></div>
                            <div></div>
                            <div></div>
                        </div>
                        <div className="skeleton-lines mt-5">
                            <div></div>
                            <div></div>
                            <div></div>
                            <div></div>
                            <div></div>
                            <div></div>
                            <div></div>
                            <div></div>
                            <div></div>
                            <div></div>
                            <div></div>
                            <div></div>
                        </div>
                        <div className="skeleton-lines mt-5">
                            <div></div>
                            <div></div>
                            <div></div>
                            <div></div>
                            <div></div>
                        </div>
                    </div>
                </div>
            </section>
            <Footer />
        </div>
    )

    return (
        <div className="App" style={{ backgroundColor: 'var(--bulma-scheme-main)' }}>
            <NavBar />
            <section className="section" style={{ backgroundColor: 'var(--bulma-scheme-main)', minHeight: '100vh' }}>
                <div className="container has-text-left">
                    <BlogBreadcrumb blogId={blogId} />

                    <Markdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                            h1: ({ ...props }) => <h1 className="title is-3 my-4" {...props} />,
                            h2: ({ ...props }) => <h2 className="title is-4 my-4" {...props} />,
                            h3: ({ ...props }) => <h3 className="title is-5 my-3" {...props} />,
                            h4: ({ ...props }) => <h4 className="title is-5 my-3" {...props} />,
                            h5: ({ ...props }) => <h5 className="title is-5 my-2" {...props} />,
                            h6: ({ ...props }) => <h6 className="title is-6 my-2" {...props} />,
                            li: ({ ...props }) => <li className="ml-4" {...props} />,
                            ul: ({ ...props }) => <ul className="ml-4 my-4" style={{ listStyle: 'disc' }} {...props} />,
                            ol: ({ ...props }) => <ol className="ml-4 my-4" style={{ listStyle: 'auto' }} {...props} />,
                            p: ({ ...props }) => <p className="my-4" {...props} />,

                        }}
                    >
                        {markdown}
                    </Markdown>
                </div>
            </section >
            <Footer />
        </div >
    )
}