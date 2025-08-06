import { useTranslations } from 'next-intl';
import Link from 'next/link';

export default function BlogBreadcrumb({ blogId = "" }: { blogId?: string }) {
    const t = useTranslations();

    return (
        <nav className="breadcrumb" aria-label="breadcrumbs">
            <ul>
                <li><Link href="/blog">{t("blogCommon.blog")}</Link></li>
                {
                    blogId ? (
                        <li className="is-active">
                            <a aria-current="page">{t(`blogs.blog${blogId}.title`)}</a>
                        </li>
                    ) : (
                        <li className="is-active">
                            <a href="#" aria-current="page">
                                <div className="skeleton-lines">
                                    <div></div>
                                </div>
                            </a>
                        </li>
                    )
                }
            </ul>
        </nav>
    );
}
