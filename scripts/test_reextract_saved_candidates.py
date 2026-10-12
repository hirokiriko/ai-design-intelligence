"""架空候補だけによるオフライン試験。ファイル・ネットワーク操作は行わない。"""
from copy import deepcopy
import unittest

from reextract_saved_candidates import EXCLUSION_REASONS, FILTER_VERSION, filter_candidates


SOURCE = "https://fixture.example/news_list/"


def candidate(suffix, path, *, title="FIXTURE candidate", hostname="fixture.example"):
    return {"id": f"kds_fixture_{suffix}", "title": title,
            "url": f"https://{hostname}{path}", "publishedAt": None}


class SavedCandidateFilterTests(unittest.TestCase):
    def test_exact_pagination_and_index_paths_have_machine_readable_reasons(self):
        values = [candidate("page_2", "/news_list/page/2/"),
                  candidate("page_12", "/news_list/page/12"),
                  candidate("index", "/news/"), candidate("index_bare", "/news")]
        result = filter_candidates(values, SOURCE)
        self.assertEqual(result["version"], FILTER_VERSION)
        self.assertEqual(FILTER_VERSION, "saved-article-links-1")
        self.assertEqual(result["candidates"], [])
        self.assertEqual([row["reason"] for row in result["excluded"]],
                         ["pagination", "pagination", "index_link", "index_link"])
        self.assertEqual([row["index"] for row in result["excluded"]], [0, 1, 2, 3])
        self.assertEqual(tuple(dict.fromkeys(row["reason"] for row in result["excluded"])), EXCLUSION_REASONS)

    def test_numeric_and_slug_article_urls_remain_even_with_navigation_like_titles(self):
        values = [candidate("numeric", "/news/12345", title="2"),
                  candidate("numeric_slash", "/news/67890/", title="次のページ"),
                  candidate("slug", "/news/fixture-product", title="Last Page"),
                  candidate("slug_digit", "/news/fixture-product-2", title="ニュース一覧"),
                  candidate("page_word", "/news/page", title="FIXTURE page")]
        result = filter_candidates(values, SOURCE)
        self.assertEqual(result["candidates"], values)
        self.assertEqual(result["excluded"], [])

    def test_query_fragment_and_similar_paths_are_retained(self):
        paths = ["/news_list/page/2/?category=FIXTURE", "/news?category=FIXTURE", "/news/\u003f",
                 "/news_list/page/2/#FIXTURE", "/news/#FIXTURE", "/news_list/page/0/",
                 "/news_list/page/01/", "/news_list/page/-2/", "/news_list/page/2.0/",
                 "/news_list/page/2/article", "/news_list/page/2//", "/news_list/page/%32/",
                 "/fixture/news_list/page/2/", "/NEWS_LIST/page/2/", "/news_list/page/two/",
                 "/news_list/pages/2/", "/news-list/page/2/", "/news_list/", "/news/fixture/",
                 "/newsroom/", "/news//"]
        values = [candidate(f"similar_{i}", path) for i, path in enumerate(paths)]
        self.assertEqual(filter_candidates(values, SOURCE)["candidates"], values)
        self.assertEqual(filter_candidates(values, SOURCE)["excluded"], [])

    def test_unknown_hostname_and_subdomain_are_not_removed(self):
        values = [candidate("other_page", "/news_list/page/2/", hostname="other.fixture.example"),
                  candidate("other_index", "/news/", hostname="fixture-other.example"),
                  candidate("lookalike", "/news/", hostname="fixture.example.invalid")]
        self.assertEqual(filter_candidates(values, SOURCE)["candidates"], values)
        self.assertEqual(filter_candidates(values, SOURCE)["excluded"], [])

    def test_hostname_comparison_is_case_insensitive_but_path_is_exact(self):
        values = [candidate("host_case", "/news/", hostname="FIXTURE.EXAMPLE"),
                  candidate("path_case", "/News/")]
        result = filter_candidates(values, "https://FIXTURE.EXAMPLE/news_list/")
        self.assertEqual(result["candidates"], [values[1]])
        self.assertEqual(result["excluded"][0]["candidate"], values[0])

    def test_preserves_order_input_and_nested_values_without_deduplication(self):
        values = [candidate("first", "/news/100"), candidate("remove", "/news_list/page/2/"),
                  candidate("second", "/news/200"), candidate("duplicate", "/news/100")]
        values[0]["extra"] = {"notes": ["FIXTURE original"]}
        values[1]["extra"] = {"notes": ["FIXTURE excluded"]}
        original = deepcopy(values)
        result = filter_candidates(values, SOURCE)
        self.assertEqual(values, original)
        self.assertEqual([row["id"] for row in result["candidates"]],
                         ["kds_fixture_first", "kds_fixture_second", "kds_fixture_duplicate"])
        result["candidates"][0]["extra"]["notes"].append("FIXTURE output mutation")
        result["excluded"][0]["candidate"]["extra"]["notes"].append("FIXTURE output mutation")
        self.assertEqual(values, original)

    def test_filter_can_run_before_top20_without_losing_later_articles(self):
        values = [candidate(f"page_{i}", f"/news_list/page/{i + 1}/") for i in range(20)]
        values += [candidate(f"article_{i}", f"/news/{1000 + i}") for i in range(22)]
        result = filter_candidates(values, SOURCE)
        self.assertEqual(len(result["excluded"]), 20)
        self.assertEqual(len(result["candidates"]), 22)
        self.assertEqual(result["candidates"][:20], values[20:40])

    def test_unresolved_or_malformed_candidate_url_is_not_silently_removed(self):
        values = [{"id": "kds_fixture_missing", "title": "FIXTURE missing"},
                  {"id": "kds_fixture_null", "url": None},
                  {"id": "kds_fixture_relative", "url": "/news/"},
                  {"id": "kds_fixture_malformed", "url": "https://[FIXTURE/news/"},
                  {"id": "kds_fixture_space", "url": " https://fixture.example/news/"}]
        self.assertEqual(filter_candidates(values, SOURCE)["candidates"], values)

    def test_source_hostname_is_required(self):
        for value in ("/news_list/", "", "https://[FIXTURE", None):
            with self.subTest(value=value), self.assertRaisesRegex(ValueError, "SOURCE_HOSTNAME_REQUIRED"):
                filter_candidates([], value)

    def test_empty_input_remains_empty(self):
        self.assertEqual(filter_candidates([], SOURCE), {"version": FILTER_VERSION, "candidates": [], "excluded": []})


if __name__ == "__main__":
    unittest.main()
