"use client"
import Footer from '@/app/components/site/footer'
import NavBar from '@/app/components/site/navbar'
import '../../App.css';
import "../../globals.scss";
import React from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useLocale } from 'next-intl';


export default function TOSPage() {
    const locale = useLocale();


    // Fetch the markdown content based on the current locale
    const [markdown, setMarkdown] = React.useState<string>("");
    React.useEffect(() => {
        const fetchMarkdown = async () => {
            try {
                const res = await fetch(`/legal/terms/${locale}.md`);
                if (res.ok) {
                    const text = await res.text();
                    setMarkdown(text);
                } else {
                    throw new Error('Network response was not ok');
                }
            } catch (error) {
                console.error('Failed to fetch markdown:', error);
            }
        };
        fetchMarkdown();
    }, [locale]);

    return (
        <div className="App" style={{ backgroundColor: 'var(--bulma-scheme-main)' }}>
            <NavBar />
            <section className="section has-text-left" style={{ backgroundColor: 'var(--bulma-scheme-main)', minHeight: '100vh' }}>
                <div className="container">
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