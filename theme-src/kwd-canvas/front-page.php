<?php
/**
 * Front page — output the self-contained design content full-bleed, no chrome.
 */
get_header();
while (have_posts()) {
  the_post();
  the_content();
}
get_footer();
