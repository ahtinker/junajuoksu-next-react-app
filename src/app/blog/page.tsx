"use client";
import '../App.css';
import "../globals.scss";
import NavBar from '../components/site/navbar';
import Footer from '../components/site/footer';
import { useTranslations } from 'next-intl';
import BlogCard from '../components/site/blogcard/card';

function BlogHomePage() {
    const t = useTranslations();

    return (
        <div className="App" style={{ backgroundColor: 'var(--bulma-scheme-main)' }}>
            <NavBar />
            <section className="section is-fullheight" style={{ backgroundColor: 'var(--bulma-scheme-main)', minHeight: '100vh' }}>
                <div className="container has-text-left">
                    <div className="">
                        <div className="title">
                            {t("blogCommon.blog")}
                        </div>
                        <div className="fixed-grid has-text-left has-1-cols-mobile">
                            <div className="grid is-gap-6">
                                <div className="cell">
                                    <BlogCard blogId={1} />
                                </div>
                                <div className="cell">
                                    <BlogCard blogId={2} />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section >
            <Footer />
        </div >
    );
}

export default BlogHomePage;
