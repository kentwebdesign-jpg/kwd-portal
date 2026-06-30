<?php
/**
 * Fallback template — same behaviour as the front page.
 */
get_header();
while (have_posts()) {
  the_post();
  the_content();
}
get_footer();
