import { useTranslations } from 'next-intl';
import Link from 'next/link';

interface BlogCardProps {
    blogId?: number;
}

export default function BlogCard({ blogId = 1 }: BlogCardProps) {

    const t = useTranslations();

    return (
        <div className="card is-shadowless" style={{ backgroundColor: "var(--bulma-background)" }}>
            <div className="card-content">
                <div className="title is-size-5" style={{ color: "var(--bulma-color)" }}>{t(`blogs.blog${blogId}.title`)}</div>
                <div className="content">
                    {t(`blogs.blog${blogId}.description`)}
                </div>
            </div>
            <footer className="card-footer">
                <Link href={`/blog/${blogId}`} className="card-footer-item">
                    <span>
                        Lue opas
                    </span>
                    <span className="icon ml-2">
                        <i className="fas fa-arrow-up-right-from-square"></i>
                    </span>
                </Link>

            </footer>
        </div>
    );
}   